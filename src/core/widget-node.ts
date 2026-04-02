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

export const isWidgetNode = (value: unknown): value is WidgetNode =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  'props' in value &&
  'children' in value;
