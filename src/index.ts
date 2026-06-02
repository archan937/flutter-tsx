/**
 * flutter.tsx — main entry point
 *
 * Re-exports all widget components, hooks, and core types.
 * The generated/ directory is created by `fsx define`.
 */

// Core types
export type { FlutterElement, WidgetNode } from './core/widget-node.js';
export { isWidgetNode } from './core/widget-node.js';

// Core factories
export type { ComponentOptions } from './core/define-component.js';
export { defineComponent } from './core/define-component.js';

// Composite fsx widgets + imperative modals
export type { TabItem } from './core/widgets.js';
export { showDialog, showSheet, TabView } from './core/widgets.js';

// Hooks
export {
  createStore,
  fetch,
  type FetchResponse,
  useAsync,
  useEffect,
  useParams,
  useState,
  useStore,
  useTranslations,
} from './core/hooks.js';

// Generated widget components (populated after `fsx define`)
export * from './generated/widget-components.js';

// Generated feature hooks
export * from './generated/feature-hooks.js';
