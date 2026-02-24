/**
 * flutter.tsx — main entry point
 *
 * Re-exports all widget components, hooks, and core types.
 * The generated/ directory is created by `fsx define`.
 */

// Core types
export type { WidgetNode, FlutterElement } from "./core/widget-node.js";
export { isWidgetNode } from "./core/widget-node.js";

// Core factories
export { defineComponent } from "./core/define-component.js";
export type { ComponentOptions } from "./core/define-component.js";

// Hooks
export { useState, useEffect } from "./core/hooks.js";

// Generated widget components (populated after `fsx define`)
export * from "./generated/widget-components.js";

// Generated feature hooks
export * from "./generated/feature-hooks.js";
