import type { WidgetNode } from './widget-node.js';

export interface ComponentOptions {
  single: string;
}

export const defineComponent = <P extends object>(
  options: ComponentOptions,
): ((props: P & { children?: unknown }) => WidgetNode) => {
  const { single } = options;

  return (props: P & { children?: unknown }): WidgetNode => {
    const { children, ...rest } = props as Record<string, unknown>;
    const childArray: unknown[] =
      children === undefined
        ? []
        : Array.isArray(children)
          ? children
          : [children];

    return {
      type: single,
      props: rest,
      children: childArray as WidgetNode[],
    };
  };
};
