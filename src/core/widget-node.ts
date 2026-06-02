export interface WidgetNode {
  type: string;
  props: Record<string, unknown>;
  children: (WidgetNode | string | number | boolean | null | undefined)[];
}

export type FlutterElement =
  | WidgetNode
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * JSX children for text-content widgets (Text, SelectableText, …): literal text
 * and/or interpolated values. A single child is `string | number`; mixed
 * text + `{expr}` arrives as an array (`<Text>Clicks: {count}</Text>`), which
 * the transpiler concatenates into one Dart interpolated string.
 */
export type TextContent = string | number;

export const isWidgetNode = (value: unknown): value is WidgetNode =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  'props' in value &&
  'children' in value;
