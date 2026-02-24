// Development runtime — re-exports the production runtime.
// Bun/TypeScript uses jsxImportSourceDev for development builds.
export { jsx, jsxs, jsxDEV, Fragment } from "./jsx-runtime.js";
export type { FlutterElement } from "./jsx-runtime.js";
