import React, { useMemo, useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { Button, Message, RadioButtonGroup, classNames, TextArea } from "pi-ui";
import { Formik, Field } from "formik";
import SelectField from "src/components/Select/SelectField";
import { withRouter } from "react-router-dom";
import { dccValidationSchema } from "./validation";
import useSessionStorage from "src/hooks/utils/useSessionStorage";
import useScrollFormOnError from "src/hooks/utils/useScrollFormOnError";
import DraftSaver from "./DraftSaver";
import styles from "./DccForm.module.css";
import {
  getDomainOptions,
  getContractorTypeOptions,
  getDccTypeOptions,
  getNomineeOptions,
  DCC_TYPE_ISSUANCE,
  DCC_TYPE_REVOCATION,
  CONTRACTOR_TYPE_REVOKED
} from "src/containers/DCC";
import usePolicy from "src/hooks/api/usePolicy";

const Select = ({ error, ...props }) => (
  <div
    className={classNames(styles.formSelect, error && styles.formSelectError)}>
    <SelectField {...props} />
    {error && <p className={styles.errorMsg}>{error}</p>}
  </div>
);

const DccForm = React.memo(function DccForm({
  values,
  handleSubmit,
  isSubmitting,
  setFieldValue,
  setFieldTouched,
  errors,
  touched,
  isValid,
  cmsUsers,
  setSessionStorageDcc,
  submitSuccess,
  isUserValid
}) {
  const [isIssuance, setIsIssuance] = useState();
  useScrollFormOnError(errors && errors.global);

  useEffect(() => {
    if (values.type === DCC_TYPE_ISSUANCE) {
      setIsIssuance(true);
    } else if (values.type === DCC_TYPE_REVOCATION) {
      setFieldValue("contractortype", CONTRACTOR_TYPE_REVOKED);
      setIsIssuance(false);
    }
  }, [values.type, setFieldValue]);

  const SubmitButton = useCallback(
    () => (
      <Button
        type="submit"
        kind={!isValid || !isUserValid ? "disabled" : "primary"}
        loading={isSubmitting}>
        Submit
      </Button>
    ),
    [isValid, isSubmitting, isUserValid]
  );

  const handleChangeDccType = (e) => {
    setFieldTouched("type", true);
    setSessionStorageDcc({
      ...values,
      type: e.value
    });
    setFieldValue("type", e.value);
    setFieldValue("nomineeid", "");
  };

  const handleChangeStatement = (e) => {
    setSessionStorageDcc({
      ...values,
      statement: e.target.value
    });
    setFieldTouched("statement", true);
    setFieldValue("statement", e.target.value);
  };

  const handleChangeSelector = (field) => (e) => {
    setFieldTouched(field, true);
    setSessionStorageDcc({
      ...values,
      [field]: e.value
    });
    setFieldValue(field, e.value);
  };

  const handleChangeNomineeSelector = (e) => {
    setFieldTouched("nomineeid", true);
    setFieldValue("nomineeid", e.value);
    setFieldValue("nomineeusername", e.label);
    setSessionStorageDcc({
      ...values,
      nomineeid: e.value,
      nomineeusername: e.label
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {errors && errors.global && (
        <Message kind="error">{errors.global.toString()}</Message>
      )}

      {!isUserValid && (
        <Message kind="error">
          You don't have the contractor status required to complete a DCC
          request
        </Message>
      )}

      {isUserValid && (
        <Message kind="info">
          Before creating a new DCC the nominee must be invited to CMS by an
          admin. Please contact an admin on DCR Contractors channel on matrix.
        </Message>
      )}

      <RadioButtonGroup
        label="DCC Type"
        name="type"
        options={getDccTypeOptions()}
        value={values.type}
        error={touched.type && errors.type}
        onChange={handleChangeDccType}
        className={styles.radioButton}
      />

      <Select
        name="domain"
        options={getDomainOptions()}
        placeholder="Domain"
        error={touched.domain && errors.domain}
        onChange={handleChangeSelector("domain")}
      />
      {isIssuance ? (
        <>
          <Select
            name="nomineeid"
            options={getNomineeOptions(cmsUsers.nominee)}
            placeholder="Nominee"
            error={touched.nomineeid && errors.nomineeid}
            onChange={handleChangeNomineeSelector}
            isDisabled={!values.type}
          />
          <Select
            name="contractortype"
            options={getContractorTypeOptions()}
            placeholder="Contractor Type"
            error={touched.contractortype && errors.contractortype}
            onChange={handleChangeSelector("contractortype")}
          />
        </>
      ) : (
        <Select
          name="nomineeid"
          options={getNomineeOptions(cmsUsers.full)}
          placeholder="Nominee"
          error={touched.nomineeid && errors.nomineeid}
          onChange={handleChangeNomineeSelector}
          isDisabled={!values.type}
        />
      )}
      <Field
        component={TextArea}
        name="statement"
        value={values.statement}
        onChange={handleChangeStatement}
        placeholder="Statement"
        id="statement"
        error={touched.statement && errors.statement}
      />
      <div className="justify-right">
        <DraftSaver {...{ submitSuccess }} />
        <SubmitButton />
      </div>
    </form>
  );
});

const DccFormWrapper = ({
  initialValues,
  onSubmit,
  history,
  cmsUsers,
  userDomain,
  isUserValid
}) => {
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { policy } = usePolicy();
  const dccFormValidation = useMemo(() => dccValidationSchema(policy), [
    policy
  ]);

  const FORM_INITIAL_VALUES = {
    type: 0,
    nomineeid: "",
    statement: "",
    domain: userDomain,
    contractortype: 0
  };

  let formInitialValues = initialValues || FORM_INITIAL_VALUES;
  const [sessionStorageDcc, setSessionStorageDcc] = useSessionStorage(
    "dcc",
    null
  );

  if (sessionStorageDcc !== null) {
    formInitialValues = sessionStorageDcc;
  }

  const isInitialValid = dccFormValidation.isValidSync(formInitialValues);

  const handleSubmit = useCallback(
    async (values, { resetForm, setSubmitting, setFieldError }) => {
      try {
        const token = await onSubmit(values);
        // Token from new dcc or from edit dcc
        const dccToken = token || values.token;
        setSubmitting(false);
        setSubmitSuccess(true);
        history.push(`/dccs/${dccToken}`);
        setSessionStorageDcc(null);
        resetForm();
      } catch (e) {
        setSubmitting(false);
        setFieldError("global", e);
      }
    },
    [history, onSubmit, setSessionStorageDcc]
  );

  return (
    <Formik
      onSubmit={handleSubmit}
      initialValues={formInitialValues}
      isInitialValid={isInitialValid}
      validationSchema={dccFormValidation}>
      {(props) => (
        <DccForm
          {...{
            ...props,
            submitSuccess,
            setSessionStorageDcc,
            cmsUsers,
            isUserValid
          }}
        />
      )}
    </Formik>
  );
};

DccFormWrapper.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func,
  setSessionStorageDcc: PropTypes.func,
  setDccType: PropTypes.func,
  history: PropTypes.object,
  cmsUsers: PropTypes.object
};

export default withRouter(DccFormWrapper);
