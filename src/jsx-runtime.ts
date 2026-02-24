import type { WidgetNode, FlutterElement } from "./core/widget-node.js";

export type { FlutterElement };

type JSXChildren =
  | FlutterElement
  | FlutterElement[]
  | undefined;

interface JSXProps {
  children?: JSXChildren;
  [key: string]: unknown;
}

/**
 * JSX factory function — called by the TypeScript/Bun JSX transform
 * for every `<Widget>` element.
 *
 * Produces a WidgetNode descriptor that the codegen later walks.
 */
export function jsx(type: string | Function, props: JSXProps, _key?: string): WidgetNode {
  const { children, ...rest } = props ?? {};

  const childArray: FlutterElement[] = children === undefined
    ? []
    : Array.isArray(children)
      ? (children as FlutterElement[])
      : [children as FlutterElement];

  const widgetType =
    typeof type === "function"
      ? (type as { displayName?: string; name?: string }).displayName ??
        (type as { name?: string }).name ??
        "Unknown"
      : type;

  return {
    type: widgetType,
    props: rest as Record<string, unknown>,
    children: childArray,
  };
}

/**
 * jsxs — same as jsx, used when there are multiple static children.
 */
export const jsxs = jsx;

/**
 * jsxDEV — development version of jsx (same implementation).
 */
export const jsxDEV = jsx;

/**
 * Fragment — for <> ... </> syntax.
 * We represent it as a special "Fragment" node; codegen ignores the wrapper.
 */
export const Fragment = "Fragment";
