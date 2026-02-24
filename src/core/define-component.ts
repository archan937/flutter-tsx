import type { WidgetNode } from "./widget-node.js";

export interface ComponentOptions {
  /** The Flutter widget class name this component maps to */
  single: string;
}

/**
 * Creates a Flutter widget component factory.
 *
 * At runtime, calling the returned function creates a WidgetNode descriptor.
 * During transpilation, the codegen walks the JSX AST directly — this runtime
 * function is only used for testing/preview purposes.
 *
 * @example
 * export const Text = defineComponent<TextProps>({ single: 'Text' });
 */
export function defineComponent<P extends object>(
  options: ComponentOptions
): (props: P & { children?: unknown }) => WidgetNode {
  const { single } = options;

  return function component(props: P & { children?: unknown }): WidgetNode {
    const { children, ...rest } = props as Record<string, unknown>;
    const childArray: unknown[] = children === undefined
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
}
