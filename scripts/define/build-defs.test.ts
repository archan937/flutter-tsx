import { describe, expect, it } from 'bun:test';
import type { ApiJson } from './api-types';
import { buildDefs } from './build-defs';

const API_FIXTURE: ApiJson = {
  _meta: {
    frameworkVersion: '3.41.2',
    dartSdkVersion: '3.11.0',
    frameworkRevision: 'abc123',
    extractedAt: '2026-01-01T00:00:00Z',
  },
  entities: [
    {
      family: 'widget',
      name: 'TestBox',
      library: 'widgets',
      doc: 'A test box widget.',
      params: [
        {
          name: 'key',
          type: { kind: 'nullable', inner: { kind: 'named', name: 'Key' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'label',
          type: { kind: 'scalar', name: 'String' },
          isNamed: true,
          isRequired: true,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'count',
          type: { kind: 'scalar', name: 'int' },
          isNamed: true,
          isRequired: false,
          hasDefault: true,
          deprecated: false,
        },
        {
          name: 'color',
          type: { kind: 'nullable', inner: { kind: 'named', name: 'Color' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'alignment',
          type: {
            kind: 'nullable',
            inner: { kind: 'enum', name: 'TestAlign' },
          },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'onPressed',
          type: {
            kind: 'nullable',
            inner: {
              kind: 'function',
              returnType: { kind: 'void' },
              params: [],
            },
          },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'child',
          type: { kind: 'nullable', inner: { kind: 'widget' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
      ],
    },
    {
      family: 'widget',
      name: 'TestList',
      library: 'widgets',
      doc: '',
      params: [
        {
          name: 'children',
          type: { kind: 'list', element: { kind: 'widget' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
      ],
    },
    {
      family: 'widget',
      name: 'TestScaffold',
      library: 'material',
      doc: '',
      params: [
        {
          name: 'body',
          type: { kind: 'nullable', inner: { kind: 'widget' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
      ],
    },
    {
      family: 'enum',
      name: 'TestAlign',
      library: 'widgets',
      values: ['left', 'right', 'center'],
    },
    {
      family: 'type',
      name: 'TestStyle',
      library: 'services',
      doc: '/// A test style class.',
      params: [
        {
          name: 'fontSize',
          type: { kind: 'nullable', inner: { kind: 'scalar', name: 'double' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
        {
          name: 'key',
          type: { kind: 'nullable', inner: { kind: 'named', name: 'Key' } },
          isNamed: true,
          isRequired: false,
          hasDefault: false,
          deprecated: false,
        },
      ],
    },
  ],
};

describe('buildDefs — widget count and names', () => {
  const result = buildDefs(API_FIXTURE);

  it('produces 3 widgets', () => expect(result.widgets).toHaveLength(3));

  it('produces 1 enum record', () => expect(result.enums).toHaveLength(1));

  it('produces 1 type record', () => expect(result.types).toHaveLength(1));

  it('enum record has correct values', () => {
    expect(result.enums[0]).toMatchObject({
      name: 'TestAlign',
      values: ['left', 'right', 'center'],
    });
  });
});

describe('buildDefs — TestStyle (TypeDef)', () => {
  const { types } = buildDefs(API_FIXTURE);
  const style = types[0]!;

  it('has correct name and library', () => {
    expect(style.name).toBe('TestStyle');
    expect(style.library).toBe('services');
  });

  it('drops key param', () => {
    expect(style.params.every((p) => p.name !== 'key')).toBe(true);
  });

  it('maps fontSize to correct tsType', () => {
    expect(style.params.find((p) => p.name === 'fontSize')?.tsType).toBe(
      'number',
    );
  });

  it('maps fontSize to correct dartType', () => {
    expect(style.params.find((p) => p.name === 'fontSize')?.dartType).toBe(
      'double?',
    );
  });
});

describe('buildDefs — TestBox props', () => {
  const { widgets } = buildDefs(API_FIXTURE);
  const box = widgets.find((w) => w.name === 'TestBox')!;

  it('drops key param', () =>
    expect(box.props.every((p) => p.name !== 'key')).toBe(true));

  it('required prop carries required: true', () => {
    expect(box.props.find((p) => p.name === 'label')?.required).toBe(true);
  });

  it('prop with default carries required: false', () => {
    expect(box.props.find((p) => p.name === 'count')?.required).toBe(false);
  });

  it('color tsType → string (named override)', () => {
    expect(box.props.find((p) => p.name === 'color')?.tsType).toBe('string');
  });

  it('color dartType → Color?', () => {
    expect(box.props.find((p) => p.name === 'color')?.dartType).toBe('Color?');
  });

  it('enum prop tsType → string-literal union from enumMap', () => {
    expect(box.props.find((p) => p.name === 'alignment')?.tsType).toBe(
      "'left' | 'right' | 'center'",
    );
  });

  it('onPressed tsxProp → onClick', () => {
    expect(box.props.find((p) => p.name === 'onPressed')?.tsxProp).toBe(
      'onClick',
    );
  });

  it('onPressed tsType → () => void', () => {
    expect(box.props.find((p) => p.name === 'onPressed')?.tsType).toBe(
      '() => void',
    );
  });

  it('onPressed transform → callback', () => {
    expect(box.props.find((p) => p.name === 'onPressed')?.transform).toBe(
      'callback',
    );
  });

  it('child tsType → FlutterElement', () => {
    expect(box.props.find((p) => p.name === 'child')?.tsType).toBe(
      'FlutterElement',
    );
  });

  it('infers child slot from child param', () => {
    expect(box.defaultChildSlot).toBe('child');
    expect(box.singleChild).toBe(true);
  });

  it('empty styling array (Phase 1)', () => expect(box.styling).toEqual([]));

  it('selfSlot empty by default', () => expect(box.selfSlot).toBe(''));
});

describe('buildDefs — TestList slot', () => {
  const { widgets } = buildDefs(API_FIXTURE);
  const list = widgets.find((w) => w.name === 'TestList')!;

  it('infers children slot', () =>
    expect(list.defaultChildSlot).toBe('children'));
  it('singleChild false for children slot', () =>
    expect(list.singleChild).toBe(false));
});

describe('buildDefs — TestScaffold slot', () => {
  const { widgets } = buildDefs(API_FIXTURE);
  const scaffold = widgets.find((w) => w.name === 'TestScaffold')!;

  it('infers body slot', () => expect(scaffold.defaultChildSlot).toBe('body'));
  it('singleChild true for body slot', () =>
    expect(scaffold.singleChild).toBe(true));
  it('category from material library → other (not in curated table)', () =>
    expect(scaffold.category).toBe('other'));
});
