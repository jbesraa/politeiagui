export * from "./app";
export * from "./api";
export * from "./modal";

export const selectorMap = fns => (...args) => Object.keys(fns)
  .reduce((res, key) => ({ ...res, [key]: fns[key](...args) }), {});
