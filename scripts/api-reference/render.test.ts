import { describe, expect, it } from 'bun:test';
import type {
  EnumEntity,
  PluginDef,
  PropDef,
  StylingDef,
  WidgetDef,
} from '../define/api-types';
import {
  cleanDoc,
  enumSection,
  escapeHtml,
  examplesSection,
  pageShell,
  pluginSection,
  propTable,
  typeSection,
  widgetSection,
} from './render';
import type { RenderedExample } from './render';

// ─── cleanDoc ─────────────────────────────────────────────────────────────────

describe('cleanDoc', () => {
  it('strips /// prefixes from each line', () => {
    expect(cleanDoc('/// Foo\n/// bar')).toBe('Foo\nbar');
  });

  it('trims leading/trailing whitespace after stripping', () => {
    expect(
      cleanDoc('///  A widget that does things.\n///\n/// More detail.'),
    ).toBe('A widget that does things.\n\nMore detail.');
  });

  it('returns empty string for empty input', () => {
    expect(cleanDoc('')).toBe('');
  });

  it('keeps only the first paragraph (up to first blank line)', () => {
    const doc = '/// Summary line.\n///\n/// Extra details not shown.';
    expect(cleanDoc(doc, { firstParagraphOnly: true })).toBe('Summary line.');
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes < > & " characters', () => {
    expect(escapeHtml('<div class="x">&amp;</div>')).toBe(
      '&lt;div class=&quot;x&quot;&gt;&amp;amp;&lt;/div&gt;',
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ─── propTable ────────────────────────────────────────────────────────────────

const makeProp = (
  name: string,
  tsType: string,
  dartType: string,
  required = false,
): PropDef => ({
  name,
  tsxProp: name,
  dartParam: name,
  dartType,
  tsType,
  required,
  transform: 'string',
});

const makeStyling = (
  name: string,
  tsType: string,
  dartType: string,
): StylingDef => ({
  name,
  tsxProp: name,
  dartParam: name,
  dartType,
  tsType,
  transform: 'string',
});

describe('propTable', () => {
  it('renders a table with thead and tbody', () => {
    const html = propTable([makeProp('title', 'string', 'String?')], []);
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html).toContain('</table>');
  });

  it('includes correct column headers', () => {
    const html = propTable([makeProp('title', 'string', 'String?')], []);
    expect(html).toContain('Prop');
    expect(html).toContain('TSX type');
    expect(html).toContain('Dart type');
    expect(html).toContain('Required');
  });

  it('emits a row per prop with correct values', () => {
    const html = propTable([makeProp('width', 'number', 'double?', false)], []);
    expect(html).toContain('width');
    expect(html).toContain('number');
    expect(html).toContain('double?');
  });

  it('marks required props distinctly', () => {
    const required = propTable(
      [makeProp('value', 'boolean', 'bool', true)],
      [],
    );
    const optional = propTable(
      [makeProp('label', 'string', 'String?', false)],
      [],
    );
    expect(required).toContain('✓');
    expect(optional).not.toContain('✓');
  });

  it('includes styling props in the same table', () => {
    const html = propTable([], [makeStyling('fontSize', 'number', 'double?')]);
    expect(html).toContain('fontSize');
  });

  it('returns empty string when both lists are empty', () => {
    expect(propTable([], [])).toBe('');
  });
});

// ─── widgetSection ────────────────────────────────────────────────────────────

const makeWidget = (name: string): WidgetDef => ({
  name,
  dartClass: name,
  category: 'layout',
  selfSlot: '',
  defaultChildSlot: 'none',
  singleChild: false,
  props: [],
  styling: [],
});

describe('widgetSection', () => {
  it('has an id matching the widget name', () => {
    const html = widgetSection(
      makeWidget('Column'),
      '',
      'material',
      '<Column />',
      'Column()',
    );
    expect(html).toContain('id="Column"');
  });

  it('contains the widget name in a heading', () => {
    const html = widgetSection(
      makeWidget('Column'),
      '',
      'material',
      '<Column />',
      'Column()',
    );
    expect(html).toContain('>Column<');
  });

  it('includes the library badge', () => {
    const html = widgetSection(
      makeWidget('Column'),
      '',
      'material',
      '<Column />',
      'Column()',
    );
    expect(html).toContain('material');
  });

  it('renders TSX and Dart code blocks in tab panels', () => {
    const html = widgetSection(
      makeWidget('SizedBox'),
      '',
      'material',
      '<SizedBox />',
      'SizedBox()',
    );
    expect(html).toContain('&lt;SizedBox /&gt;'); // escaped TSX in a panel
    expect(html).toContain('SizedBox()'); // Dart in a panel
    expect(html).toContain('tab-panel');
    expect(html).toContain('tab-btn');
  });

  it('includes data-name attribute for search filtering', () => {
    const html = widgetSection(
      makeWidget('Text'),
      '',
      'material',
      '<Text />',
      'Text()',
    );
    expect(html).toContain('data-name="Text"');
  });
});

// ─── enumSection ──────────────────────────────────────────────────────────────

describe('enumSection', () => {
  const themeMode: EnumEntity = {
    family: 'enum',
    name: 'ThemeMode',
    library: 'material',
    values: ['system', 'light', 'dark'],
  };

  it('has an id matching the enum name', () => {
    expect(enumSection(themeMode)).toContain('id="ThemeMode"');
  });

  it('lists all enum values', () => {
    const html = enumSection(themeMode);
    expect(html).toContain('system');
    expect(html).toContain('light');
    expect(html).toContain('dark');
  });

  it('shows Dart enum syntax (ThemeMode.system)', () => {
    const html = enumSection(themeMode);
    expect(html).toContain('ThemeMode.system');
  });

  it('shows TSX literal union syntax', () => {
    const html = enumSection(themeMode);
    expect(html).toContain('"system"');
  });
});

// ─── pageShell ────────────────────────────────────────────────────────────────

describe('pageShell', () => {
  const counts = { widgets: 539, enums: 130 };
  // navHtml is now caller-generated; pass a minimal stub
  const stubNav = `<details open><summary>Layout<span class="nav-count">17</span></summary>
<ul><li data-name="Column"><a href="#Column">Column</a></li></ul>
</details>
<details><summary>Enums<span class="nav-count">130</span></summary>
<ul><li data-name="ThemeMode"><a href="#ThemeMode">ThemeMode</a></li></ul>
</details>
<details><summary>Hooks &amp; Core APIs<span class="nav-count">10</span></summary>
<ul><li data-name="useState"><a href="#useState">useState</a></li></ul>
</details>`;

  it('includes a search input', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('<input');
    expect(html).toMatch(/type=['"]search['"]/);
  });

  it('places the nav HTML verbatim in the sidebar', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('href="#Column"');
    expect(html).toContain('href="#ThemeMode"');
    expect(html).toContain('href="#useState"');
  });

  it('places the main content in the page body', () => {
    const html = pageShell(
      '<section id="test">hello</section>',
      stubNav,
      counts,
    );
    expect(html).toContain('<section id="test">hello</section>');
  });

  it('is a valid HTML document', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('reports widget and enum counts in the meta strip', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('539');
    expect(html).toContain('130');
  });

  it('passes sidebar data-name attributes through verbatim', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('data-name="Column"');
    expect(html).toContain('data-name="ThemeMode"');
    expect(html).toContain('data-name="useState"');
  });

  it('search JS targets sidebar li[data-name] elements', () => {
    const html = pageShell('', stubNav, counts);
    expect(html).toContain('sidebar-nav li[data-name]');
    expect(html).toContain('initialOpen');
  });
});

// ─── typeSection ─────────────────────────────────────────────────────────────

describe('typeSection', () => {
  const textStyleDef = {
    name: 'TextStyle',
    dartClass: 'TextStyle',
    library: 'material',
    doc: '/// An immutable style describing how to format and paint text.',
    params: [makeProp('fontSize', 'number', 'double?')],
  };

  it('has an id matching the type name', () => {
    expect(typeSection(textStyleDef)).toContain('id="TextStyle"');
  });

  it('shows the type name in a heading', () => {
    expect(typeSection(textStyleDef)).toContain('>TextStyle<');
  });

  it('includes the library badge', () => {
    expect(typeSection(textStyleDef)).toContain('material');
  });

  it('includes a type badge', () => {
    expect(typeSection(textStyleDef)).toContain('type');
  });

  it('renders the doc string', () => {
    expect(typeSection(textStyleDef)).toContain('An immutable style');
  });

  it('includes data-name for search filtering', () => {
    expect(typeSection(textStyleDef)).toContain('data-name="TextStyle"');
  });

  it('renders a props table when params exist', () => {
    expect(typeSection(textStyleDef)).toContain('fontSize');
  });

  it('renders no table when params are empty', () => {
    const noParams = { ...textStyleDef, params: [] };
    expect(typeSection(noParams)).not.toContain('<table');
  });
});

// ─── pluginSection ────────────────────────────────────────────────────────────

const makePlugin = (overrides: Partial<PluginDef> = {}): PluginDef => ({
  name: 'useCamera',
  tsxName: 'useCamera',
  domain: 'media',
  surface: 'action',
  description: 'Access the device camera to capture photos and video.',
  package: 'camera',
  pubspecDep: 'camera: ^0.10.6',
  dartImport: "import 'package:camera/camera.dart';",
  tsxExample: 'const cam = useCamera();\nawait cam.takePicture();',
  dartExample: 'final cam = CameraController(...);\nawait cam.takePicture();',
  ...overrides,
});

describe('pluginSection', () => {
  it('has an id matching tsxName', () => {
    expect(pluginSection(makePlugin())).toContain('id="useCamera"');
  });

  it('includes data-name for search filtering', () => {
    expect(pluginSection(makePlugin())).toContain('data-name="useCamera"');
  });

  it('renders the plugin name in a heading', () => {
    expect(pluginSection(makePlugin())).toContain('>useCamera<');
  });

  it('includes domain badge', () => {
    expect(pluginSection(makePlugin())).toContain('Media');
  });

  it('includes surface badge', () => {
    expect(pluginSection(makePlugin())).toContain('action hook');
  });

  it('renders the package badge when package is present', () => {
    expect(pluginSection(makePlugin())).toContain('badge-pkg');
    expect(pluginSection(makePlugin())).toContain('camera');
  });

  it('omits the package badge when package is absent', () => {
    const html = pluginSection(makePlugin({ package: undefined }));
    expect(html).not.toContain('badge-pkg');
  });

  it('renders description', () => {
    expect(pluginSection(makePlugin())).toContain('Access the device camera');
  });

  it('renders TSX and Dart tab panels', () => {
    const html = pluginSection(makePlugin());
    expect(html).toContain('tab-panel');
    expect(html).toContain('tab-btn');
    expect(html).toContain('useCamera()');
  });

  it('handles tsxName with dots (utility functions)', () => {
    const html = pluginSection(
      makePlugin({
        tsxName: 'hapticFeedback.light',
        name: 'hapticFeedback.light',
      }),
    );
    expect(html).toContain('id="hapticFeedback.light"');
    expect(html).toContain('data-name="hapticFeedback.light"');
  });
});

// ─── examplesSection ─────────────────────────────────────────────────────────

describe('examplesSection', () => {
  const examples: RenderedExample[] = [
    {
      id: 'hello-world',
      title: 'Hello World',
      description: 'The simplest app.',
      tsx: 'export const App = () => <Center />;',
      dart: 'Center()',
    },
    {
      id: 'counter',
      title: 'Counter',
      description: 'Uses useState.',
      tsx: 'const [n, setN] = useState(0);',
      dart: 'int n = 0;',
    },
  ];

  it('wraps examples in a section with id="examples"', () => {
    expect(examplesSection(examples)).toContain('id="examples"');
  });

  it('emits an article per example with correct id', () => {
    const html = examplesSection(examples);
    expect(html).toContain('id="ex-hello-world"');
    expect(html).toContain('id="ex-counter"');
  });

  it('includes the example title in a heading', () => {
    const html = examplesSection(examples);
    expect(html).toContain('>Hello World<');
    expect(html).toContain('>Counter<');
  });

  it('renders TSX and Dart in tab panels', () => {
    const html = examplesSection(examples);
    expect(html).toContain('tab-panel');
    expect(html).toContain('tab-btn');
  });

  it('escapes TSX code content', () => {
    const html = examplesSection(examples);
    expect(html).toContain('&lt;Center /&gt;');
  });
});
