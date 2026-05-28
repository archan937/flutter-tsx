import type { ChildSlot, PropDef, WidgetDef } from '../define/api-types';

const MAX_EXAMPLE_PROPS = 3;

const firstEnumLiteral = (tsType: string): string | null => {
  const match = tsType.match(/'([^']+)'/);
  return match ? match[1] : null;
};

const exampleAttrValue = (prop: PropDef): string | null => {
  switch (prop.transform) {
    case 'string':
      return '"example"';
    case 'int':
      return '{8}';
    case 'double':
      return '{16}';
    case 'color':
      return '"#2196F3"';
    case 'enum': {
      const lit = firstEnumLiteral(prop.tsType);
      return lit ? `"${lit}"` : null;
    }
    case 'none': {
      if (prop.tsType === 'boolean') return '{true}';
      if (prop.tsType === 'string') return '"example"';
      if (prop.tsType === 'number') return '{16}';
      return null;
    }
    // widget, callback, textStyle, edgeinsets, style → skip
    default:
      return null;
  }
};

const buildAttrs = (props: PropDef[]): string => {
  const parts: string[] = [];
  for (const prop of props) {
    if (parts.length >= MAX_EXAMPLE_PROPS) break;
    const val = exampleAttrValue(prop);
    if (val !== null) parts.push(`${prop.tsxProp}=${val}`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
};

const wrapWithChildren = (
  tagName: string,
  attrs: string,
  slot: ChildSlot,
): string => {
  const open = `<${tagName}${attrs}>`;
  const close = `</${tagName}>`;

  if (slot === 'none') return `<${tagName}${attrs} />`;
  if (slot === 'children') {
    return `${open}<Text>Item 1</Text><Text>Item 2</Text>${close}`;
  }
  // child, home, body, title → single child
  const label = slot === 'child' ? 'Label' : 'Content';
  return `${open}<Text>${label}</Text>${close}`;
};

/**
 * Synthesize a minimal, valid TSX snippet for a widget — suitable for display
 * in the API reference and for piping through the real transpiler.
 *
 * Rules:
 * - At most 3 props; picks the first eligible ones by transform.
 * - Skips widget/callback/textStyle/edgeinsets/style props (too noisy).
 * - Adds children based on defaultChildSlot.
 */
export const synthesizeTsx = (widget: WidgetDef): string => {
  const attrs = buildAttrs(widget.props);
  return wrapWithChildren(widget.name, attrs, widget.defaultChildSlot);
};
