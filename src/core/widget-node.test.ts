import { describe, expect, it } from 'bun:test';

import {
  type FlutterElement,
  isWidgetNode,
  type WidgetNode,
} from './widget-node.js';

describe('isWidgetNode', () => {
  it('returns true for a valid WidgetNode', () => {
    const node: WidgetNode = {
      type: 'Text',
      props: { style: 'bold' },
      children: [],
    };
    expect(isWidgetNode(node)).toBe(true);
  });

  it('returns true when children contain nested nodes', () => {
    const node: WidgetNode = {
      type: 'Column',
      props: {},
      children: [{ type: 'Text', props: {}, children: [] }, 'hello', 42],
    };
    expect(isWidgetNode(node)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isWidgetNode(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isWidgetNode(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isWidgetNode('text')).toBe(false);
    expect(isWidgetNode(42)).toBe(false);
    expect(isWidgetNode(true)).toBe(false);
  });

  it('returns false for objects missing type', () => {
    expect(isWidgetNode({ props: {}, children: [] })).toBe(false);
  });

  it('returns false for objects missing props', () => {
    expect(isWidgetNode({ type: 'X', children: [] })).toBe(false);
  });

  it('returns false for objects missing children', () => {
    expect(isWidgetNode({ type: 'X', props: {} })).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isWidgetNode([1, 2, 3])).toBe(false);
  });

  it('satisfies FlutterElement union type', () => {
    const elements: FlutterElement[] = [
      { type: 'Text', props: {}, children: [] },
      'string',
      42,
      true,
      null,
      undefined,
    ];
    expect(elements).toHaveLength(6);
  });
});
