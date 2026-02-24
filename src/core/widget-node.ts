/**
 * Represents a Flutter widget node in the virtual tree.
 * This is what the JSX factory produces at runtime — it carries
 * enough information for the Dart codegen to reconstruct the widget call.
 */
export interface WidgetNode {
  /** Flutter widget class name, e.g. "Text", "ElevatedButton" */
  type: string;
  /** Props/attributes passed to the widget */
  props: Record<string, unknown>;
  /** Child nodes (already resolved WidgetNodes or primitive values) */
  children: (WidgetNode | string | number | boolean | null | undefined)[];
}

export type FlutterElement = WidgetNode | string | number | boolean | null | undefined;

/** Type guard: is this value a WidgetNode? */
export function isWidgetNode(value: unknown): value is WidgetNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "children" in value
  );
}
