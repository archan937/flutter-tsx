import '../../test/helpers/resemble.js';

import { describe, expect, it } from 'bun:test';
import type { PropDef, WidgetDef } from '../define/api-types';
import { synthesizeTsx } from './synthesize';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const makeProp = ({
  name,
  ...rest
}: Partial<PropDef> & { name: string }): PropDef => ({
  name,
  tsxProp: name,
  dartParam: name,
  dartType: 'dynamic',
  tsType: 'unknown',
  required: false,
  transform: 'none',
  ...rest,
});

const makeWidget = ({
  name,
  ...rest
}: Partial<WidgetDef> & { name: string }): WidgetDef => ({
  name,
  dartClass: name,
  category: 'other',
  selfSlot: '',
  defaultChildSlot: 'none',
  singleChild: false,
  childContent: 'none',
  props: [],
  styling: [],
  ...rest,
});

// ─── Child placement ──────────────────────────────────────────────────────────

describe('synthesizeTsx — child placement', () => {
  it('self-closes when defaultChildSlot is "none"', () => {
    const tsx = synthesizeTsx(makeWidget({ name: 'Spacer' }));
    expect(tsx).toBe('<Spacer />');
  });

  it('adds two children when defaultChildSlot is "children"', () => {
    const tsx = synthesizeTsx(
      makeWidget({ name: 'Column', defaultChildSlot: 'children' }),
    );
    expect(tsx).toBe('<Column><Text>Item 1</Text><Text>Item 2</Text></Column>');
  });

  it('adds one child when defaultChildSlot is "child"', () => {
    const tsx = synthesizeTsx(
      makeWidget({ name: 'Center', defaultChildSlot: 'child' }),
    );
    expect(tsx).toBe('<Center><Text>Label</Text></Center>');
  });

  it('adds one child for named slots (home, body, title)', () => {
    const home = synthesizeTsx(
      makeWidget({ name: 'MaterialApp', defaultChildSlot: 'home' }),
    );
    const body = synthesizeTsx(
      makeWidget({ name: 'Scaffold', defaultChildSlot: 'body' }),
    );
    expect(home).toBe('<MaterialApp><Text>Content</Text></MaterialApp>');
    expect(body).toBe('<Scaffold><Text>Content</Text></Scaffold>');
  });
});

// ─── Prop value synthesis ─────────────────────────────────────────────────────

describe('synthesizeTsx — prop value synthesis', () => {
  it('uses first enum literal for enum transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Column',
        defaultChildSlot: 'children',
        props: [
          makeProp({
            name: 'mainAxisAlignment',
            tsType: "'start' | 'end' | 'center'",
            transform: 'enum',
          }),
        ],
      }),
    );
    expect(tsx).toBe(
      '<Column mainAxisAlignment="start"><Text>Item 1</Text><Text>Item 2</Text></Column>',
    );
  });

  it('uses {16} for double transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'SizedBox',
        props: [
          makeProp({ name: 'width', tsType: 'number', transform: 'double' }),
        ],
      }),
    );
    expect(tsx).toBe('<SizedBox width={16} />');
  });

  it('uses {8} for int transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Flex',
        props: [makeProp({ name: 'flex', tsType: 'number', transform: 'int' })],
      }),
    );
    expect(tsx).toBe('<Flex flex={8} />');
  });

  it('uses "example" for string transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'AppBar',
        props: [
          makeProp({ name: 'title', tsType: 'string', transform: 'string' }),
        ],
      }),
    );
    expect(tsx).toBe('<AppBar title="example" />');
  });

  it('uses {true} for boolean tsType with none transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Switch',
        props: [
          makeProp({ name: 'value', tsType: 'boolean', transform: 'none' }),
        ],
      }),
    );
    expect(tsx).toBe('<Switch value={true} />');
  });

  it('uses "#2196F3" for color transform', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Container',
        props: [
          makeProp({ name: 'color', tsType: 'string', transform: 'color' }),
        ],
      }),
    );
    expect(tsx).toBe('<Container color="#2196F3" />');
  });

  it('skips widget transform props', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Center',
        defaultChildSlot: 'child',
        props: [
          makeProp({
            name: 'child',
            tsType: 'FlutterElement',
            transform: 'widget',
          }),
        ],
      }),
    );
    expect(tsx).toBe('<Center><Text>Label</Text></Center>');
  });

  it('skips callback transform props', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Button',
        props: [
          makeProp({
            name: 'onPressed',
            tsType: '() => void',
            transform: 'callback',
          }),
        ],
      }),
    );
    expect(tsx).toBe('<Button />');
  });

  it('skips unknown/dynamic none-transform props', () => {
    const tsx = synthesizeTsx(
      makeWidget({
        name: 'Foo',
        props: [
          makeProp({ name: 'whatever', tsType: 'unknown', transform: 'none' }),
        ],
      }),
    );
    expect(tsx).toBe('<Foo />');
  });
});

// ─── Prop count limit ─────────────────────────────────────────────────────────

describe('synthesizeTsx — prop count limit', () => {
  it('emits at most 3 props even with many eligible props', () => {
    const props = ['a', 'b', 'c', 'd', 'e'].map((n) =>
      makeProp({ name: n, tsType: 'number', transform: 'int' }),
    );
    const tsx = synthesizeTsx(makeWidget({ name: 'Widget', props }));
    // At most 3 props are emitted (one ={8} each), even with 5 eligible.
    expect(tsx).toBe('<Widget a={8} b={8} c={8} />');
  });

  it('produces a bare self-closing tag when all props are skippable', () => {
    const props = [
      makeProp({ name: 'a', tsType: 'unknown', transform: 'none' }),
      makeProp({ name: 'b', tsType: 'FlutterElement', transform: 'widget' }),
    ];
    const tsx = synthesizeTsx(makeWidget({ name: 'Empty', props }));
    expect(tsx).toBe('<Empty />');
  });
});

// ─── Integration: synthesized TSX produces valid Dart via real transpiler ─────

describe('synthesizeTsx — transpiler integration', () => {
  it('Column TSX transpiles to Dart containing Column(', async () => {
    const { parseSource } = await import('../../src/transpiler/parser');
    const { generateDartFile } = await import('../../src/transpiler/codegen');

    const column = makeWidget({
      name: 'Column',
      defaultChildSlot: 'children',
      props: [
        makeProp({
          name: 'mainAxisAlignment',
          tsType: "'start' | 'end'",
          transform: 'enum',
        }),
      ],
    });

    const tsx = synthesizeTsx(column);
    const src = `export function Example() { return ${tsx}; }`;
    const { sourceFile, exports } = parseSource(src, 'example.tsx');
    const dart = generateDartFile(sourceFile, exports)
      .split('\n')
      .slice(2)
      .join('\n')
      .trimStart();

    expect(dart).toResemble(`
      import 'package:flutter/material.dart';

      class Example extends StatelessWidget {
        const Example({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(mainAxisAlignment: MainAxisAlignment.start, children: [Text('Item 1'), Text('Item 2')]);
        }
      }
    `);
  });
});
