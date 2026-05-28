import type { WidgetNode } from '@src/core/widget-node.js';
import { Fragment, jsx, jsxDEV, jsxs } from '@src/jsx-runtime.js';
import { describe, expect, it } from 'bun:test';

describe('jsx', () => {
  it('creates a WidgetNode from a string type', () => {
    const result = jsx('Text', { color: 'red' });
    expect(result).toEqual({
      type: 'Text',
      props: { color: 'red' },
      children: [],
    });
  });

  it('extracts single child to array', () => {
    const child: WidgetNode = { type: 'Icon', props: {}, children: [] };
    const result = jsx('Column', { children: child });

    expect(result.children).toEqual([child]);
    expect(result.props).toEqual({});
  });

  it('keeps array children as-is', () => {
    const children: WidgetNode[] = [
      { type: 'Text', props: {}, children: [] },
      { type: 'Icon', props: {}, children: [] },
    ];
    const result = jsx('Row', { children });

    expect(result.children).toEqual(children);
  });

  it('handles no children', () => {
    const result = jsx('Divider', {});
    expect(result.children).toEqual([]);
  });

  it('handles undefined children explicitly', () => {
    const result = jsx('SizedBox', { children: undefined });
    expect(result.children).toEqual([]);
  });

  it('resolves function type using name from named function expression', () => {
    const MyButton = function MyButton(): WidgetNode {
      return { type: 'ElevatedButton', props: {}, children: [] };
    };
    const result = jsx(MyButton, {});
    expect(result.type).toBe('MyButton');
  });

  it('resolves function type using displayName over name', () => {
    const MyWidget = function MyWidget(): WidgetNode {
      return { type: 'ElevatedButton', props: {}, children: [] };
    };
    (MyWidget as unknown as { displayName: string }).displayName = 'CustomName';
    const result = jsx(MyWidget, {});
    expect(result.type).toBe('CustomName');
  });

  it('returns empty string type for a function with an empty name', () => {
    // ?? is nullish — empty string is not null/undefined so it passes through as ''
    const anon = Object.defineProperty(
      (): WidgetNode => ({ type: 'X', props: {}, children: [] }),
      'name',
      { value: '' },
    ) as () => WidgetNode;
    const result = jsx(anon, {});
    expect(result.type).toBe('');
  });

  it('does not include children in props', () => {
    const result = jsx('Center', { children: 'hello', key: '1' });
    expect('children' in result.props).toBe(false);
    expect(result.props).toEqual({ key: '1' });
  });

  it('passes string children through', () => {
    const result = jsx('Text', { children: 'hello world' });
    expect(result.children).toEqual(['hello world']);
  });
});

describe('jsxs', () => {
  it('is the same function as jsx', () => {
    expect(jsxs).toBe(jsx);
  });
});

describe('jsxDEV', () => {
  it('is the same function as jsx', () => {
    expect(jsxDEV).toBe(jsx);
  });
});

describe('Fragment', () => {
  it('is the string "Fragment"', () => {
    expect(Fragment).toBe('Fragment');
  });
});
