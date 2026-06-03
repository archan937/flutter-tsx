import '../../test/helpers/resemble.js';

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
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

const fixture = (name: string): string =>
  readFileSync(join(import.meta.dir, '__fixtures__', name), 'utf-8');

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
  it('renders a full table for an optional prop', () => {
    expect(propTable([makeProp('title', 'string', 'String?')], [])).toResemble(`
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>title</td><td>string</td><td>String?</td><td class="req"></td></tr>
      </tbody>
      </table>
    `);
  });

  it('emits a row with the prop name, TSX type and Dart type', () => {
    expect(
      propTable([makeProp('width', 'number', 'double?', false)], []),
    ).toResemble(`
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>width</td><td>number</td><td>double?</td><td class="req"></td></tr>
      </tbody>
      </table>
    `);
  });

  it('marks a required prop with ✓', () => {
    expect(
      propTable([makeProp('value', 'boolean', 'bool', true)], []),
    ).toResemble(`
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>value</td><td>boolean</td><td>bool</td><td class="req">✓</td></tr>
      </tbody>
      </table>
    `);
  });

  it('leaves the required cell empty for an optional prop', () => {
    expect(
      propTable([makeProp('label', 'string', 'String?', false)], []),
    ).toResemble(`
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>label</td><td>string</td><td>String?</td><td class="req"></td></tr>
      </tbody>
      </table>
    `);
  });

  it('includes styling props in the same table', () => {
    expect(
      propTable([], [makeStyling('fontSize', 'number', 'double?')]),
    ).toResemble(`
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>fontSize</td><td>number</td><td>double?</td><td class="req"></td></tr>
      </tbody>
      </table>
    `);
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
  childContent: 'none',
  props: [],
  styling: [],
});

describe('widgetSection', () => {
  it('renders the full widget article (id, heading, badges, data-name)', () => {
    expect(
      widgetSection(makeWidget('Column'), '', 'material', '<Column />', 'Column()'),
    ).toResemble(`
      <article class="widget" id="Column" data-name="Column">
      <h3>Column<span class="badge badge-lib">material</span><span class="badge badge-cat">layout</span></h3>

      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">&lt;Column /&gt;</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">Column()</code></pre>
      </div>
      </div>
      </article>
    `);
  });

  it('renders TSX and Dart code blocks in tab panels (escaped TSX)', () => {
    expect(
      widgetSection(
        makeWidget('SizedBox'),
        '',
        'material',
        '<SizedBox />',
        'SizedBox()',
      ),
    ).toResemble(`
      <article class="widget" id="SizedBox" data-name="SizedBox">
      <h3>SizedBox<span class="badge badge-lib">material</span><span class="badge badge-cat">layout</span></h3>

      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">&lt;SizedBox /&gt;</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">SizedBox()</code></pre>
      </div>
      </div>
      </article>
    `);
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

  it('renders the full enum article (TSX union + Dart values)', () => {
    expect(enumSection(themeMode)).toResemble(`
      <article class="widget enum-entry" id="ThemeMode" data-name="ThemeMode">
      <h3>ThemeMode<span class="badge badge-lib">material</span></h3>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-typescript">"system" | "light" | "dark"</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <ul class="enum-values"><li><code>ThemeMode.system</code></li>
      <li><code>ThemeMode.light</code></li>
      <li><code>ThemeMode.dark</code></li></ul>
      </div>
      </div>
      </article>
    `);
  });
});

// ─── pageShell ────────────────────────────────────────────────────────────────

describe('pageShell', () => {
  const counts = { widgets: 539, enums: 130 };
  const stubNav = `<details open><summary>Layout<span class="nav-count">17</span></summary>
<ul><li data-name="Column"><a href="#Column">Column</a></li></ul>
</details>
<details><summary>Enums<span class="nav-count">130</span></summary>
<ul><li data-name="ThemeMode"><a href="#ThemeMode">ThemeMode</a></li></ul>
</details>
<details><summary>Hooks &amp; Core APIs<span class="nav-count">10</span></summary>
<ul><li data-name="useState"><a href="#useState">useState</a></li></ul>
</details>`;

  // The page shell is a full ~300-line styled HTML document; assert it in full
  // against a golden fixture (regenerate the fixture if pageShell changes).
  it('renders the full document shell (search, nav, counts, search JS)', () => {
    expect(pageShell('', stubNav, counts)).toResemble(
      fixture('page-shell-empty.html'),
    );
  });

  it('places the main content in the page body', () => {
    expect(
      pageShell('<section id="test">hello</section>', stubNav, counts),
    ).toResemble(fixture('page-shell-content.html'));
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

  it('renders the full type article with a props table', () => {
    expect(typeSection(textStyleDef)).toResemble(`
      <article class="widget type-entry" id="TextStyle" data-name="TextStyle">
      <h3>TextStyle<span class="badge badge-lib">material</span><span class="badge badge-cat">type</span></h3>
      <p class="doc">An immutable style describing how to format and paint text.</p>
      <table class="props">
      <thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
      <tbody>
      <tr><td>fontSize</td><td>number</td><td>double?</td><td class="req"></td></tr>
      </tbody>
      </table>
      </article>
    `);
  });

  it('renders no table when params are empty', () => {
    expect(typeSection({ ...textStyleDef, params: [] })).toResemble(`
      <article class="widget type-entry" id="TextStyle" data-name="TextStyle">
      <h3>TextStyle<span class="badge badge-lib">material</span><span class="badge badge-cat">type</span></h3>
      <p class="doc">An immutable style describing how to format and paint text.</p>

      </article>
    `);
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
  it('renders the full plugin article (badges, description, tab panels)', () => {
    expect(pluginSection(makePlugin())).toResemble(`
      <article class="widget plugin-entry" id="useCamera" data-name="useCamera">
      <h3>useCamera<span class="badge badge-pkg">camera</span><span class="badge badge-lib">Media</span><span class="badge badge-cat">action hook</span></h3>
      <p class="doc">Access the device camera to capture photos and video.</p>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">const cam = useCamera();
      await cam.takePicture();</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">final cam = CameraController(...);
      await cam.takePicture();</code></pre>
      </div>
      </div>
      </article>
    `);
  });

  it('omits the package badge when package is absent', () => {
    expect(pluginSection(makePlugin({ package: undefined }))).toResemble(`
      <article class="widget plugin-entry" id="useCamera" data-name="useCamera">
      <h3>useCamera<span class="badge badge-lib">Media</span><span class="badge badge-cat">action hook</span></h3>
      <p class="doc">Access the device camera to capture photos and video.</p>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">const cam = useCamera();
      await cam.takePicture();</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">final cam = CameraController(...);
      await cam.takePicture();</code></pre>
      </div>
      </div>
      </article>
    `);
  });

  it('handles tsxName with dots (utility functions)', () => {
    expect(
      pluginSection(
        makePlugin({
          tsxName: 'hapticFeedback.light',
          name: 'hapticFeedback.light',
        }),
      ),
    ).toResemble(`
      <article class="widget plugin-entry" id="hapticFeedback.light" data-name="hapticFeedback.light">
      <h3>hapticFeedback.light<span class="badge badge-pkg">camera</span><span class="badge badge-lib">Media</span><span class="badge badge-cat">action hook</span></h3>
      <p class="doc">Access the device camera to capture photos and video.</p>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">const cam = useCamera();
      await cam.takePicture();</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">final cam = CameraController(...);
      await cam.takePicture();</code></pre>
      </div>
      </div>
      </article>
    `);
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

  it('renders the full examples section (one article per example)', () => {
    expect(examplesSection(examples)).toResemble(`
      <section id="examples">
      <h2>Examples</h2>
      <article class="widget example-card" id="ex-hello-world" data-name="hello-world">
      <h3>Hello World</h3>
      <p class="doc">The simplest app.</p>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">export const App = () =&gt; &lt;Center /&gt;;</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">Center()</code></pre>
      </div>
      </div>
      </article>
      <article class="widget example-card" id="ex-counter" data-name="counter">
      <h3>Counter</h3>
      <p class="doc">Uses useState.</p>
      <div class="tabs">
      <div class="tab-btns" role="tablist">
      <button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
      <button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
      </div>
      <div class="tab-panel active" data-panel="tsx" role="tabpanel">
      <pre><code class="language-tsx">const [n, setN] = useState(0);</code></pre>
      </div>
      <div class="tab-panel" data-panel="dart" role="tabpanel">
      <pre><code class="language-dart">int n = 0;</code></pre>
      </div>
      </div>
      </article>
      </section>
    `);
  });
});
