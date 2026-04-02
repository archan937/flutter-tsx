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
