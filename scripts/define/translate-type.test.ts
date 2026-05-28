import { describe, expect, it } from 'bun:test';
import type { TypeNode } from './api-types';
import { dartTypeString, translateType } from './translate-type';

const noEnums = new Map<string, string[]>();

// ─── scalars ─────────────────────────────────────────────────────────────────

describe('translateType scalars', () => {
  it.each([
    ['String', 'string'],
    ['bool', 'boolean'],
    ['int', 'number'],
    ['double', 'number'],
    ['num', 'number'],
  ] as const)('%s → %s', (name, expected) => {
    expect(translateType({ kind: 'scalar', name }, noEnums)).toBe(expected);
  });

  it('void → void', () =>
    expect(translateType({ kind: 'void' }, noEnums)).toBe('void'));
  it('unknown → unknown', () =>
    expect(translateType({ kind: 'unknown' }, noEnums)).toBe('unknown'));
});

// ─── nullable (strips outer; optionality lives at prop key level) ─────────────

describe('translateType nullable', () => {
  it('nullable scalar delegates to inner', () => {
    expect(
      translateType(
        { kind: 'nullable', inner: { kind: 'scalar', name: 'String' } },
        noEnums,
      ),
    ).toBe('string');
  });

  it('double-nullable collapses', () => {
    const node: TypeNode = {
      kind: 'nullable',
      inner: { kind: 'nullable', inner: { kind: 'scalar', name: 'bool' } },
    };
    expect(translateType(node, noEnums)).toBe('boolean');
  });
});

// ─── collections ─────────────────────────────────────────────────────────────

describe('translateType collections', () => {
  it('List<String> → string[]', () =>
    expect(
      translateType(
        { kind: 'list', element: { kind: 'scalar', name: 'String' } },
        noEnums,
      ),
    ).toBe('string[]'));

  it('List<Widget> → FlutterElement[]', () =>
    expect(
      translateType({ kind: 'list', element: { kind: 'widget' } }, noEnums),
    ).toBe('FlutterElement[]'));

  it('nullable List<Widget> → FlutterElement[]', () => {
    const node: TypeNode = {
      kind: 'nullable',
      inner: { kind: 'list', element: { kind: 'widget' } },
    };
    expect(translateType(node, noEnums)).toBe('FlutterElement[]');
  });

  it('Set<int> → Set<number>', () =>
    expect(
      translateType(
        { kind: 'set', element: { kind: 'scalar', name: 'int' } },
        noEnums,
      ),
    ).toBe('Set<number>'));

  it('Map<String,int> → Record<string,number>', () =>
    expect(
      translateType(
        {
          kind: 'map',
          key: { kind: 'scalar', name: 'String' },
          value: { kind: 'scalar', name: 'int' },
        },
        noEnums,
      ),
    ).toBe('Record<string, number>'));

  it('Future<String> → Promise<string>', () =>
    expect(
      translateType(
        { kind: 'future', value: { kind: 'scalar', name: 'String' } },
        noEnums,
      ),
    ).toBe('Promise<string>'));

  it('nested List<Color>? → string[]', () => {
    const node: TypeNode = {
      kind: 'nullable',
      inner: { kind: 'list', element: { kind: 'named', name: 'Color' } },
    };
    expect(translateType(node, noEnums)).toBe('string[]');
  });
});

// ─── enums ───────────────────────────────────────────────────────────────────

describe('translateType enums', () => {
  const enums = new Map([['MainAxisAlignment', ['start', 'end', 'center']]]);

  it('known enum → string-literal union', () =>
    expect(
      translateType({ kind: 'enum', name: 'MainAxisAlignment' }, enums),
    ).toBe("'start' | 'end' | 'center'"));

  it('unknown enum → string fallback', () =>
    expect(translateType({ kind: 'enum', name: 'MissingEnum' }, noEnums)).toBe(
      'string',
    ));

  it('nullable enum → same union (no change for nullability)', () => {
    const node: TypeNode = {
      kind: 'nullable',
      inner: { kind: 'enum', name: 'MainAxisAlignment' },
    };
    expect(translateType(node, enums)).toBe("'start' | 'end' | 'center'");
  });
});

// ─── callbacks ───────────────────────────────────────────────────────────────

describe('translateType callbacks', () => {
  it('void Function() → () => void', () =>
    expect(
      translateType(
        { kind: 'function', returnType: { kind: 'void' }, params: [] },
        noEnums,
      ),
    ).toBe('() => void'));

  it('ValueChanged<int> → (value: number) => void', () => {
    const node: TypeNode = {
      kind: 'function',
      returnType: { kind: 'void' },
      params: [
        {
          name: 'value',
          type: { kind: 'scalar', name: 'int' },
          named: false,
          required: true,
        },
      ],
    };
    expect(translateType(node, noEnums)).toBe('(value: number) => void');
  });

  it('String Function(int) → (i: number) => string', () => {
    const node: TypeNode = {
      kind: 'function',
      returnType: { kind: 'scalar', name: 'String' },
      params: [
        {
          name: 'i',
          type: { kind: 'scalar', name: 'int' },
          named: false,
          required: true,
        },
      ],
    };
    expect(translateType(node, noEnums)).toBe('(i: number) => string');
  });

  it('strips BuildContext params', () => {
    const node: TypeNode = {
      kind: 'function',
      returnType: { kind: 'widget' },
      params: [
        {
          name: 'context',
          type: { kind: 'named', name: 'BuildContext' },
          named: false,
          required: true,
        },
        {
          name: 'index',
          type: { kind: 'scalar', name: 'int' },
          named: false,
          required: true,
        },
      ],
    };
    expect(translateType(node, noEnums)).toBe(
      '(index: number) => FlutterElement',
    );
  });

  it('nullable callback → same type', () => {
    const node: TypeNode = {
      kind: 'nullable',
      inner: { kind: 'function', returnType: { kind: 'void' }, params: [] },
    };
    expect(translateType(node, noEnums)).toBe('() => void');
  });
});

// ─── widget ───────────────────────────────────────────────────────────────────

describe('translateType widget', () => {
  it('widget → FlutterElement', () =>
    expect(translateType({ kind: 'widget' }, noEnums)).toBe('FlutterElement'));

  it('nullable widget → FlutterElement', () =>
    expect(
      translateType({ kind: 'nullable', inner: { kind: 'widget' } }, noEnums),
    ).toBe('FlutterElement'));
});

// ─── named (value classes with curated overrides or unknown fallback) ─────────

describe('translateType named', () => {
  it.each([
    ['Color', 'string'],
    [
      'EdgeInsetsGeometry',
      'number | [number, number] | [number, number, number, number]',
    ],
    [
      'EdgeInsets',
      'number | [number, number] | [number, number, number, number]',
    ],
    ['AlignmentGeometry', 'string'],
    ['Alignment', 'string'],
    ['TextStyle', 'TextStyleProps'],
    ['IconData', 'string'],
    [
      'FontWeight',
      "'normal' | 'bold' | 'w100' | 'w200' | 'w300' | 'w400' | 'w500' | 'w600' | 'w700' | 'w800' | 'w900'",
    ],
    [
      'TextInputType',
      "'text' | 'number' | 'phone' | 'email' | 'url' | 'multiline'",
    ],
  ] as const)('%s → %s', (name, expected) => {
    expect(translateType({ kind: 'named', name }, noEnums)).toBe(expected);
  });

  it('unknown value class → unknown', () =>
    expect(
      translateType({ kind: 'named', name: 'SomeObscureDartClass' }, noEnums),
    ).toBe('unknown'));
});

// ─── dartTypeString ───────────────────────────────────────────────────────────

describe('dartTypeString', () => {
  it.each([
    [{ kind: 'scalar', name: 'String' } as TypeNode, 'String'],
    [
      { kind: 'nullable', inner: { kind: 'scalar', name: 'bool' } } as TypeNode,
      'bool?',
    ],
    [{ kind: 'nullable', inner: { kind: 'widget' } } as TypeNode, 'Widget?'],
    [{ kind: 'list', element: { kind: 'widget' } } as TypeNode, 'List<Widget>'],
    [
      {
        kind: 'nullable',
        inner: { kind: 'list', element: { kind: 'widget' } },
      } as TypeNode,
      'List<Widget>?',
    ],
    [{ kind: 'enum', name: 'Axis' } as TypeNode, 'Axis'],
    [
      {
        kind: 'map',
        key: { kind: 'scalar', name: 'String' },
        value: { kind: 'scalar', name: 'int' },
      } as TypeNode,
      'Map<String, int>',
    ],
    [{ kind: 'void' } as TypeNode, 'void'],
    [{ kind: 'unknown' } as TypeNode, 'dynamic'],
  ])('serialises %o → %s', (node, expected) => {
    expect(dartTypeString(node)).toBe(expected);
  });

  it('function type', () =>
    expect(
      dartTypeString({
        kind: 'function',
        returnType: { kind: 'void' },
        params: [],
      }),
    ).toBe('void Function()'));

  it('set type', () =>
    expect(
      dartTypeString({
        kind: 'set',
        element: { kind: 'scalar', name: 'String' },
      }),
    ).toBe('Set<String>'));
});
