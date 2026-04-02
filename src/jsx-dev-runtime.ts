// Development runtime — re-exports the production runtime.
// Bun/TypeScript uses jsxImportSourceDev for development builds.
export type { FlutterElement } from './jsx-runtime.js';
export { Fragment, jsx, jsxDEV, jsxs } from './jsx-runtime.js';
