import type { FlutterElement, WidgetNode } from './core/widget-node.js';

export type { FlutterElement };

type JSXChildren = FlutterElement | FlutterElement[] | undefined;

interface JSXProps {
  children?: JSXChildren;
  [key: string]: unknown;
}

type JSXType = string | ((props: JSXProps) => WidgetNode);

export const jsx = (type: JSXType, props: JSXProps): WidgetNode => {
  const { children, ...rest } = props ?? {};

  const childArray: FlutterElement[] =
    children === undefined
      ? []
      : Array.isArray(children)
        ? (children as FlutterElement[])
        : [children as FlutterElement];

  const widgetType =
    typeof type === 'function'
      ? ((type as { displayName?: string; name?: string }).displayName ??
        (type as { name?: string }).name ??
        'Unknown')
      : type;

  return {
    type: widgetType,
    props: rest as Record<string, unknown>,
    children: childArray,
  };
};

export const jsxs = jsx;

export const jsxDEV = jsx;

export const Fragment = 'Fragment';

/**
 * The JSX namespace TypeScript consults under `jsx: react-jsx` +
 * `jsxImportSource: 'flutter-tsx'` (it reads it from this jsx-runtime module,
 * NOT the global one). Widget *element types* come from the imported component
 * signatures; this only needs the cross-cutting bits:
 * - `Element` — every widget call returns a WidgetNode.
 * - `IntrinsicAttributes` — attributes valid on ANY element. `key` is the JSX
 *   list-render key (the transpiler reads it, never emits it as a Dart prop),
 *   so `<Widget key={…} />` type-checks everywhere.
 */
// A `namespace` is the only way to declare the JSX type contract that
// `jsx: react-jsx` + `jsxImportSource: 'flutter-tsx'` reads from this module —
// there is no ES-module equivalent, so the no-namespace rule can't apply here.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = WidgetNode;
  export interface IntrinsicAttributes {
    key?: string | number;
  }
}
