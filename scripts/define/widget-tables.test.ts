import { describe, expect, it } from 'bun:test';
import type { ParamInfo, Transform, TypeNode } from './api-types';
import {
  inferCategory,
  inferChildSlot,
  inferTransform,
  mapDartPropToTsx,
} from './widget-tables';

// ─── mapDartPropToTsx ─────────────────────────────────────────────────────────

describe('mapDartPropToTsx', () => {
  it.each([
    ['onPressed', 'onClick'],
    ['onChanged', 'onChange'],
    ['onSubmitted', 'onSubmit'],
    ['onTap', 'onTap'],
    ['backgroundColor', 'backgroundColor'],
    ['mainAxisAlignment', 'mainAxisAlignment'],
  ])('%s → %s', (dartProp, expected) => {
    expect(mapDartPropToTsx(dartProp)).toBe(expected);
  });

  it('returns "constructor" as-is without hitting Object.prototype', () => {
    expect(mapDartPropToTsx('constructor')).toBe('constructor');
  });

  it('returns "toString" as-is without hitting Object.prototype', () => {
    expect(mapDartPropToTsx('toString')).toBe('toString');
  });
});

// ─── inferTransform ───────────────────────────────────────────────────────────

describe('inferTransform', () => {
  const scalar = (name: 'String' | 'int' | 'double' | 'bool'): TypeNode => ({
    kind: 'scalar',
    name,
  });
  const nullable = (inner: TypeNode): TypeNode => ({ kind: 'nullable', inner });
  const named = (name: string): TypeNode => ({ kind: 'named', name });
  const fn: TypeNode = {
    kind: 'function',
    returnType: { kind: 'void' },
    params: [],
  };
  const widget: TypeNode = { kind: 'widget' };

  it.each([
    ['onPressed', scalar('String'), 'callback'],
    ['onChanged', fn, 'callback'],
    ['handler', fn, 'callback'],
    ['child', widget, 'widget'],
    ['child', nullable(widget), 'widget'],
    ['color', nullable(named('Color')), 'color'],
    ['borderColor', named('Color'), 'color'],
    ['padding', nullable(named('EdgeInsetsGeometry')), 'edgeinsets'],
    ['style', nullable(named('TextStyle')), 'textStyle'],
    [
      'alignment',
      { kind: 'enum', name: 'MainAxisAlignment' } satisfies TypeNode,
      'enum',
    ],
    [
      'alignment',
      nullable({ kind: 'enum', name: 'MainAxisAlignment' }),
      'enum',
    ],
    ['count', scalar('int'), 'int'],
    ['opacity', scalar('double'), 'double'],
    ['label', scalar('String'), 'string'],
    ['label', nullable(scalar('String')), 'string'],
    ['key', nullable(named('Key')), 'none'],
    ['slivers', nullable({ kind: 'list', element: widget }), 'none'],
  ] as [string, TypeNode, Transform][])(
    'inferTransform(%s, %#) → %s',
    (propName, node, expected) => {
      expect(inferTransform(propName, node)).toBe(expected);
    },
  );
});

// ─── inferChildSlot ───────────────────────────────────────────────────────────

const param = (name: string, type: TypeNode): ParamInfo => ({
  name,
  type,
  isNamed: true,
  isRequired: false,
  hasDefault: false,
  deprecated: false,
});

const widget: TypeNode = { kind: 'widget' };
const nullableWidget: TypeNode = { kind: 'nullable', inner: widget };
const listWidget: TypeNode = { kind: 'list', element: widget };
const nullableListWidget: TypeNode = { kind: 'nullable', inner: listWidget };

describe('inferChildSlot', () => {
  it('child: Widget? → child, singleChild', () =>
    expect(inferChildSlot([param('child', nullableWidget)])).toEqual({
      defaultChildSlot: 'child',
      singleChild: true,
    }));

  it('child: Widget (non-nullable) → child, singleChild', () =>
    expect(inferChildSlot([param('child', widget)])).toEqual({
      defaultChildSlot: 'child',
      singleChild: true,
    }));

  it('children: List<Widget>? → children, not singleChild', () =>
    expect(inferChildSlot([param('children', nullableListWidget)])).toEqual({
      defaultChildSlot: 'children',
      singleChild: false,
    }));

  it('children: List<Widget> → children', () =>
    expect(inferChildSlot([param('children', listWidget)])).toEqual({
      defaultChildSlot: 'children',
      singleChild: false,
    }));

  it('body: Widget? → body', () =>
    expect(inferChildSlot([param('body', nullableWidget)])).toEqual({
      defaultChildSlot: 'body',
      singleChild: true,
    }));

  it('home: Widget? → home', () =>
    expect(inferChildSlot([param('home', nullableWidget)])).toEqual({
      defaultChildSlot: 'home',
      singleChild: true,
    }));

  it('title: Widget? → title', () =>
    expect(inferChildSlot([param('title', nullableWidget)])).toEqual({
      defaultChildSlot: 'title',
      singleChild: true,
    }));

  it('no slot param → none', () =>
    expect(
      inferChildSlot([param('label', { kind: 'scalar', name: 'String' })]),
    ).toEqual({
      defaultChildSlot: 'none',
      singleChild: false,
    }));

  it('children takes priority over child', () =>
    expect(
      inferChildSlot([
        param('child', nullableWidget),
        param('children', listWidget),
      ]),
    ).toEqual({
      defaultChildSlot: 'children',
      singleChild: false,
    }));

  it('non-Widget body param → treated as non-slot', () =>
    expect(
      inferChildSlot([param('body', { kind: 'scalar', name: 'String' })]),
    ).toEqual({
      defaultChildSlot: 'none',
      singleChild: false,
    }));
});

// ─── inferCategory ────────────────────────────────────────────────────────────

describe('inferCategory', () => {
  it('curated widget → correct category', () =>
    expect(inferCategory('material', 'Scaffold')).toBe('layout'));
  it('curated navigation → correct category', () =>
    expect(inferCategory('material', 'AppBar')).toBe('navigation'));
  it('unknown widget defaults to other', () =>
    expect(inferCategory('material', 'FancyNewWidget')).toBe('other'));
  it('cupertino → other by default', () =>
    expect(inferCategory('cupertino', 'CupertinoButton')).toBe('other'));
});
