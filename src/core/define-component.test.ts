import { describe, expect, it } from 'bun:test';

import { defineComponent } from './define-component.js';

describe('defineComponent', () => {
  it('returns a function that produces a WidgetNode', () => {
    const MyWidget = defineComponent<{ title: string }>({ single: 'MyWidget' });
    const result = MyWidget({ title: 'hello' });

    expect(result).toEqual({
      type: 'MyWidget',
      props: { title: 'hello' },
      children: [],
    });
  });

  it('extracts children from props and normalizes to array', () => {
    const Box = defineComponent<object>({ single: 'Box' });
    const child = { type: 'Text', props: {}, children: [] };
    const result = Box({ children: child });

    expect(result.children).toEqual([child]);
    expect(result.props).toEqual({});
  });

  it('handles array children', () => {
    const Col = defineComponent<object>({ single: 'Column' });
    const children = [
      { type: 'Text', props: {}, children: [] },
      { type: 'Icon', props: {}, children: [] },
    ];
    const result = Col({ children });

    expect(result.children).toEqual(children);
    expect(result.props).toEqual({});
  });

  it('handles string children', () => {
    const Text = defineComponent<{ style?: string }>({ single: 'Text' });
    const result = Text({ children: 'hello', style: 'bold' });

    expect(result.type).toBe('Text');
    expect(result.children).toEqual(['hello']);
    expect(result.props).toEqual({ style: 'bold' });
  });

  it('handles no children', () => {
    const Divider = defineComponent<object>({ single: 'Divider' });
    const result = Divider({});

    expect(result.children).toEqual([]);
  });

  it('handles null and undefined children', () => {
    const Box = defineComponent<object>({ single: 'Box' });

    expect(Box({ children: null }).children).toEqual([null]);
    expect(Box({ children: undefined }).children).toEqual([]);
  });

  it('preserves all non-children props', () => {
    const W = defineComponent<{ a: number; b: string }>({ single: 'W' });
    const result = W({ a: 1, b: 'two' });

    expect(result.props).toEqual({ a: 1, b: 'two' });
  });

  it('uses single as the widget type name', () => {
    const FA = defineComponent<object>({ single: 'FloatingActionButton' });
    expect(FA({}).type).toBe('FloatingActionButton');
  });
});
