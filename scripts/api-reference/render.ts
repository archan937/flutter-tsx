import type {
  EnumEntity,
  PluginDef,
  PluginDomain,
  PluginSurface,
  PropDef,
  StylingDef,
  TypeDef,
  WidgetDef,
} from '../define/api-types';
import type { Example } from './examples-data';

/** Example with transpiler-generated Dart (produced in build.ts, not authored). */
export type RenderedExample = Example & { dart: string };

// ─── Text helpers ─────────────────────────────────────────────────────────────

export const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Strip Dart `///` doc-comment markers and normalise whitespace.
 * Pass `{ firstParagraphOnly: true }` to keep only the first blank-line-delimited paragraph.
 */
export const cleanDoc = (
  raw: string,
  opts: { firstParagraphOnly?: boolean } = {},
): string => {
  if (!raw) return '';
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\/\/\/\s?/, '').trimEnd());
  const text = lines.join('\n').trim();
  if (!opts.firstParagraphOnly) return text;
  const firstBlank = text.indexOf('\n\n');
  return firstBlank === -1 ? text : text.slice(0, firstBlank).trim();
};

// ─── Props table ──────────────────────────────────────────────────────────────

export const propTable = (props: PropDef[], styling: StylingDef[]): string => {
  const allProps = [...props, ...styling];
  if (allProps.length === 0) return '';

  const rows = allProps
    .map((p) => {
      const req = 'required' in p && p.required ? '✓' : '';
      return `<tr><td>${escapeHtml(p.tsxProp)}</td><td>${escapeHtml(p.tsType)}</td><td>${escapeHtml(p.dartType)}</td><td class="req">${req}</td></tr>`;
    })
    .join('\n');

  return `<table class="props">
<thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
};

// ─── Widget section ───────────────────────────────────────────────────────────

export const widgetSection = (
  widget: WidgetDef,
  doc: string,
  library: string,
  tsxExample: string,
  dartExample: string,
): string => {
  const summary = cleanDoc(doc, { firstParagraphOnly: true });
  const table = propTable(widget.props, widget.styling);

  return `<article class="widget" id="${widget.name}" data-name="${widget.name}">
<h3>${escapeHtml(widget.name)}<span class="badge badge-lib">${escapeHtml(library)}</span><span class="badge badge-cat">${escapeHtml(widget.category)}</span></h3>
${summary ? `<p class="doc">${escapeHtml(summary)}</p>` : ''}
${table}
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-tsx">${escapeHtml(tsxExample)}</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<pre><code class="language-dart">${escapeHtml(dartExample)}</code></pre>
</div>
</div>
</article>`;
};

// ─── Enum section ─────────────────────────────────────────────────────────────

export const enumSection = (en: EnumEntity): string => {
  const tsxUnion = en.values.map((v) => `"${escapeHtml(v)}"`).join(' | ');
  const dartValues = en.values
    .map((v) => `<li><code>${escapeHtml(en.name)}.${escapeHtml(v)}</code></li>`)
    .join('\n');
  return `<article class="widget enum-entry" id="${en.name}" data-name="${en.name}">
<h3>${escapeHtml(en.name)}<span class="badge badge-lib">${escapeHtml(en.library)}</span></h3>
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-typescript">${tsxUnion}</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<ul class="enum-values">${dartValues}</ul>
</div>
</div>
</article>`;
};

// ─── Type section ────────────────────────────────────────────────────────────

export const typeSection = (typeDef: TypeDef): string => {
  const summary = cleanDoc(typeDef.doc, { firstParagraphOnly: true });
  const table = propTable(typeDef.params, []);

  return `<article class="widget type-entry" id="${typeDef.name}" data-name="${typeDef.name}">
<h3>${escapeHtml(typeDef.name)}<span class="badge badge-lib">${escapeHtml(typeDef.library)}</span><span class="badge badge-cat">type</span></h3>
${summary ? `<p class="doc">${escapeHtml(summary)}</p>` : ''}
${table}
</article>`;
};

// ─── Plugin section ───────────────────────────────────────────────────────────

export const DOMAIN_LABELS: Record<PluginDomain, string> = {
  media: 'Media',
  'maps-location': 'Maps & Location',
  'storage-data': 'Storage & Data',
  security: 'Security',
  'files-assets': 'Files & Assets',
  'device-system': 'Device & System',
  'web-networking': 'Web & Networking',
  'auth-payments': 'Auth & Payments',
  navigation: 'Navigation',
  utility: 'Utility',
};

export const SURFACE_LABELS: Record<PluginSurface, string> = {
  action: 'action hook',
  state: 'state hook',
  client: 'client hook',
  widget: 'widget',
  function: 'function',
};

export const pluginSection = (plugin: PluginDef): string => {
  const domainLabel = DOMAIN_LABELS[plugin.domain];
  const surfaceLabel = SURFACE_LABELS[plugin.surface];
  const packageBadge = plugin.package
    ? `<span class="badge badge-pkg">${escapeHtml(plugin.package)}</span>`
    : '';

  return `<article class="widget plugin-entry" id="${plugin.tsxName}" data-name="${plugin.tsxName}">
<h3>${escapeHtml(plugin.tsxName)}${packageBadge}<span class="badge badge-lib">${escapeHtml(domainLabel)}</span><span class="badge badge-cat">${escapeHtml(surfaceLabel)}</span></h3>
<p class="doc">${escapeHtml(plugin.description)}</p>
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-tsx">${escapeHtml(plugin.tsxExample)}</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<pre><code class="language-dart">${escapeHtml(plugin.dartExample)}</code></pre>
</div>
</div>
</article>`;
};

// ─── Hooks section ────────────────────────────────────────────────────────────

interface CoreApi {
  name: string;
  doc: string;
  tsx: string;
  dart: string;
}

// Hand-authored core hooks + APIs (not SDK-derived). Native capability hooks
// (useCamera, useLocation, …) and useNavigate live in the Native Plugins section.
export const CORE_APIS: CoreApi[] = [
  {
    name: 'useState',
    doc: 'Declares a reactive state variable. Rewritten to a Dart StatefulWidget with setState().',
    tsx: `const [count, setCount] = useState(0);\nreturn <Text>{count}</Text>;`,
    dart: `int count = 0;\n// setCount(x) -> setState(() { count = x; });\nWidget build(BuildContext context) => Text('$count');`,
  },
  {
    name: 'useEffect',
    doc: 'Runs a side-effect on mount, with optional cleanup. Transpiles to initState + dispose.',
    tsx: `useEffect(() => {\n  final id = startTimer();\n  return () => cancel(id);\n}, []);`,
    dart: `@override\nvoid initState() { super.initState(); /* effect */ }\n@override\nvoid dispose() { /* cleanup */ super.dispose(); }`,
  },
  {
    name: 'createStore',
    doc: 'Defines a shared store (Zustand-style). Generates an idiomatic ChangeNotifier, provided at the app root via provider.',
    tsx: `export const useCounter = createStore((set) => ({\n  count: 0,\n  increment: () => set((s) => ({ count: s.count + 1 })),\n}));`,
    dart: `class CounterStore extends ChangeNotifier {\n  int count = 0;\n  void increment() { count = count + 1; notifyListeners(); }\n}`,
  },
  {
    name: 'useStore',
    doc: 'Reads a store in a screen. Destructuring the hook becomes context.watch reads + action calls; the ChangeNotifierProvider is wired into main.dart.',
    tsx: `const { count, increment } = useCounter();\nreturn <Text>{count}</Text>;`,
    dart: `final counterStore = context.watch<CounterStore>();\nfinal count = counterStore.count;\nfinal increment = counterStore.increment;`,
  },
  {
    name: 'useAsync',
    doc: 'Runs a future and exposes { data, loading, error }. Compiles to a FutureBuilder.',
    tsx: `const { data, loading, error } = useAsync(() => fetch(url));\nif (loading) return <CircularProgressIndicator />;\nreturn <Text>{data.body}</Text>;`,
    dart: `return FutureBuilder(\n  future: _fsxFetch(url),\n  builder: (context, snapshot) {\n    if (snapshot.connectionState != ConnectionState.done) {\n      return const CircularProgressIndicator();\n    }\n    final data = snapshot.data!;\n    return Text(data.body);\n  },\n);`,
  },
  {
    name: 'fetch',
    doc: 'Built-in HTTP source over the http package. Resolves to a { ok, status, body, json } response; composes with useAsync.',
    tsx: `const { data } = useAsync(() => fetch('https://api.example.com/posts'));`,
    dart: `// generated helper over package:http\nfuture: _fsxFetch('https://api.example.com/posts')`,
  },
  {
    name: 'useParams',
    doc: 'Reads a route path parameter inside a screen (file-based routing).',
    tsx: `const id = useParams('id'); // on /users/[id]\nreturn <Text>{id}</Text>;`,
    dart: `final id = GoRouterState.of(context).pathParameters['id']!;`,
  },
  {
    name: 'useTranslations',
    doc: 'Returns t(key) resolving from locales/*.json; the transpiler generates l10n.dart.',
    tsx: `const t = useTranslations();\nreturn <Text>{t('app.title')}</Text>;`,
    dart: `// from generated l10n.dart\nText(t('app.title'))`,
  },
  {
    name: 'TabView',
    doc: 'Bottom-navigation shell. Generates a Scaffold + BottomNavigationBar + IndexedStack (tab state preserved).',
    tsx: `<TabView tabs={[\n  { label: 'Home', icon: 'home', screen: <Home /> },\n  { label: 'Profile', icon: 'person', screen: <Profile /> },\n]} />`,
    dart: `Scaffold(\n  body: IndexedStack(index: _index, children: [Home(), Profile()]),\n  bottomNavigationBar: BottomNavigationBar(\n    currentIndex: _index,\n    onTap: (i) => setState(() => _index = i),\n    items: const [ /* … */ ],\n  ),\n)`,
  },
  {
    name: 'showSheet / showDialog',
    doc: 'Imperative modals. Call from a handler; map 1:1 to showModalBottomSheet / showDialog.',
    tsx: `<ElevatedButton onClick={() => showSheet(<Cart />)}>Cart</ElevatedButton>`,
    dart: `showModalBottomSheet(context: context, builder: (context) => Cart())`,
  },
  {
    name: 'Gesture props',
    doc: 'onTap / onDoubleTap / onLongPress on ANY widget. Native gesture widgets (GestureDetector, InkWell) pass through; everything else is auto-wrapped in a GestureDetector.',
    tsx: `<Container onTap={() => select(id)} onLongPress={() => remove(id)}>\n  <Text>{label}</Text>\n</Container>`,
    dart: `GestureDetector(\n  onTap: () { select(id); },\n  onLongPress: () { remove(id); },\n  child: Container(child: Text(label)),\n)`,
  },
  {
    name: 'animate',
    doc: 'Implicit animation. Add `animate` (+ optional duration/curve) to an animatable widget and its prop changes tween automatically — the transpiler swaps it for its Animated* twin.',
    tsx: `<Container animate duration={300} curve="easeInOut"\n  width={open ? 240 : 120}\n  color={open ? 'blue' : 'grey'} />`,
    dart: `AnimatedContainer(\n  duration: Duration(milliseconds: 300),\n  curve: Curves.easeInOut,\n  width: open ? 240 : 120,\n  color: open ? Colors.blue : Colors.grey,\n)`,
  },
];

export const hooksSection = (): string => {
  const articles = CORE_APIS.map(
    (
      h,
    ) => `<article class="widget" id="${h.name.split(' ')[0]}" data-name="${h.name}">
<h3>${h.name}</h3>
<p class="doc">${h.doc}</p>
${exampleTabs(h.tsx, h.dart)}
</article>`,
  ).join('\n');
  return `<section id="hooks">
<h2>Hooks &amp; Core APIs (${CORE_APIS.length})</h2>
<p>Core hooks for state, async data, routing, and i18n, plus composite widgets (TabView) and modals. Native capability hooks — <code>useCamera</code>, <code>useLocation</code>, <code>useNavigate</code>, and more — are in the <strong>Native Plugins</strong> section below.</p>
${articles}
</section>`;
};

// ─── Examples section ─────────────────────────────────────────────────────────

const exampleTabs = (tsx: string, dart: string): string =>
  `<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-tsx">${escapeHtml(tsx)}</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<pre><code class="language-dart">${escapeHtml(dart)}</code></pre>
</div>
</div>`;

export const examplesSection = (examples: RenderedExample[]): string => {
  const cards = examples
    .map(
      (
        ex,
      ) => `<article class="widget example-card" id="ex-${ex.id}" data-name="${ex.id}">
<h3>${escapeHtml(ex.title)}</h3>
<p class="doc">${escapeHtml(ex.description)}</p>
${exampleTabs(ex.tsx, ex.dart)}
</article>`,
    )
    .join('\n');

  return `<section id="examples">
<h2>Examples</h2>
${cards}
</section>`;
};

// ─── Page shell ───────────────────────────────────────────────────────────────

/**
 * Wrap the generated content in the full HTML page shell.
 *
 * @param content   The main section HTML (examples + widgets + enums + hooks).
 * @param navHtml   Pre-built sidebar nav markup (accordion <details> blocks).
 * @param counts    Widget and enum totals for the meta strip.
 */
export const pageShell = (
  content: string,
  navHtml: string,
  counts: {
    widgets: number;
    enums: number;
    types?: number;
    plugins?: number;
    hooks?: number;
  },
): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flutter.tsx — API Reference</title>
<style>
/* ── Reset + base ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body { display: flex; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #e6edf3; line-height: 1.6;
  background:
    radial-gradient(1100px 520px at 50% -120px, rgba(84,164,255,0.16), transparent 70%),
    radial-gradient(900px 500px at 85% 8%, rgba(167,139,250,0.12), transparent 65%),
    #0d1117;
  background-attachment: fixed; }

/* ── Sidebar ─── */
#sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto;
  width: 230px; min-width: 230px; background: #161b22; border-right: 1px solid #30363d;
  padding: 14px 10px 20px; font-size: 13px; flex-shrink: 0; }
#search { width: 100%; padding: 7px 10px; border: 1px solid #30363d; border-radius: 6px;
  font-size: 13px; margin-bottom: 8px; outline: none; background: #0d1117; color: #e6edf3; }
#search::placeholder { color: #484f58; }
#search:focus { border-color: #54a4ff; box-shadow: 0 0 0 2px rgba(84,164,255,.15); }
.meta-info { font-size: 11px; color: #484f58; margin-bottom: 10px; padding: 0 2px; }

/* ── Sidebar accordion ─── */
details { margin-bottom: 2px; }
details > summary {
  cursor: pointer; list-style: none; display: flex; align-items: center;
  padding: 5px 6px; border-radius: 5px; font-weight: 600; color: #8b949e;
  user-select: none; gap: 5px; }
details > summary:hover { background: #21262d; color: #e6edf3; }
details > summary::-webkit-details-marker { display: none; }
details > summary::before {
  content: '▶'; font-size: 8px; color: #484f58; flex-shrink: 0;
  transition: transform .18s; display: inline-block; width: 10px; }
details[open] > summary::before { transform: rotate(90deg); }
.nav-count { font-weight: 400; color: #484f58; font-size: 11px; margin-left: auto; }
details > ul { list-style: none; padding: 2px 0 4px 18px; }
details > ul li { margin: 1px 0; }
details > ul li a {
  display: block; padding: 2px 6px; border-radius: 4px; color: #8b949e;
  text-decoration: none; font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; transition: background .12s; }
details > ul li a:hover { background: #21262d; color: #e6edf3; }
details > ul li a.active { background: #1c2d45; color: #54a4ff; font-weight: 600; }

/* ── Main content ─── */
main { flex: 1; max-width: 900px; padding: 36px 48px; min-width: 0; }
h1 {
  font-size: 28px; font-weight: 700; margin-bottom: 8px;
  background: linear-gradient(135deg, #54a4ff 0%, #a78bfa 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; }
.subtitle { color: #8b949e; margin-bottom: 32px; font-size: 15px; }
h2 { font-size: 20px; font-weight: 700; margin: 48px 0 20px; padding-bottom: 8px;
  border-bottom: 2px solid #21262d; color: #e6edf3; }
h2:first-of-type { margin-top: 0; }

/* ── Widget card ─── */
.widget { border: 1px solid #30363d; border-radius: 8px; padding: 20px 22px;
  margin-bottom: 24px; scroll-margin-top: 20px; background: #161b22; }
.widget[hidden] { display: none; }
.widget h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; display: flex;
  align-items: center; gap: 8px; flex-wrap: wrap; color: #e6edf3; }
p.doc { color: #8b949e; font-size: 14px; margin-bottom: 12px; }

/* ── Example card ─── */
.example-card h3 { font-size: 17px; }

/* ── Badges ─── */
.badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px;
  text-transform: lowercase; }
.badge-lib { background: #1c2d45; color: #54a4ff; }
.badge-cat { background: #21262d; color: #8b949e; }
.badge-pkg { background: #1a2d22; color: #56d364; }

/* ── Props table ─── */
.props { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
.props th { text-align: left; padding: 6px 10px; background: #21262d;
  border-bottom: 2px solid #30363d; font-weight: 600; color: #8b949e; }
.props td { padding: 5px 10px; border-bottom: 1px solid #21262d; vertical-align: top;
  color: #e6edf3; }
.props td:first-child { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 12px;
  color: #54a4ff; }
.props td:nth-child(2), .props td:nth-child(3) { font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; color: #8b949e; }
.req { color: #ff7b72; font-weight: 700; text-align: center; }

/* ── Tabs ─── */
.tabs { margin-top: 12px; border: 1px solid #30363d; border-radius: 6px; overflow: hidden; }
.tab-btns { display: flex; background: #21262d; border-bottom: 1px solid #30363d; }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -1px; padding: 7px 16px; cursor: pointer; font-size: 12px; font-weight: 600;
  color: #8b949e; transition: color .15s; letter-spacing: .02em; }
.tab-btn:hover { color: #e6edf3; }
.tab-btn.active { color: #54a4ff; border-bottom-color: #54a4ff; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
pre { margin: 0; background: #161b22; padding: 14px 16px; overflow-x: auto;
  white-space: pre; word-wrap: normal; }
code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px;
  line-height: 1.55; color: #e6edf3; }

/* ── Nested sidebar accordion (Widgets > categories, Native Plugins > domains) ─── */
details details { margin: 1px 0; }
details details > summary { font-size: 12px; font-weight: 500; padding: 3px 6px; }
details details > ul { padding-left: 24px; }

/* ── Enum values list ─── */
.enum-values { list-style: none; display: flex; flex-wrap: wrap; gap: 6px;
  padding: 10px 0; }
.enum-values li code { background: #21262d; border: 1px solid #30363d; border-radius: 4px;
  padding: 2px 8px; font-size: 12px; }

/* ── No-results message ─── */
#no-results { display: none; padding: 32px; text-align: center; color: #484f58; font-size: 15px; }

/* ── Prism.js token colours (GitHub Dark palette) ─── */
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #8b949e; font-style: italic; }
.token.keyword, .token.rule, .token.important, .token.atrule { color: #ff7b72; }
.token.string, .token.char, .token.attr-value, .token.regex { color: #a5d6ff; }
.token.function { color: #d2a8ff; }
.token.class-name { color: #ffa657; }
.token.number, .token.boolean, .token.builtin { color: #79c0ff; }
.token.operator, .token.entity, .token.url { color: #e6edf3; }
.token.punctuation { color: #8b949e; }
.token.tag, .token.selector { color: #7ee787; }
.token.attr-name, .token.property { color: #79c0ff; }
.token.constant, .token.symbol { color: #ffa657; }
.token.deleted { color: #ff7b72; }
.token.inserted { color: #7ee787; }
.token.namespace { opacity: 0.7; }
</style>
</head>
<body>
<aside id="sidebar">
  <input id="search" type="search" placeholder="Search widgets…" autocomplete="off" spellcheck="false">
  <div class="meta-info">${counts.widgets} widgets · ${counts.plugins !== undefined ? `${counts.plugins} plugins · ` : ''}${counts.hooks !== undefined ? `${counts.hooks} hooks · ` : ''}${counts.types !== undefined ? `${counts.types} types · ` : ''}${counts.enums} enums</div>
  <nav id="sidebar-nav">
${navHtml}
  </nav>
</aside>
<main>
  <h1>Flutter.tsx — API Reference</h1>
  <p class="subtitle">Auto-generated from the live Flutter widget catalog. Run <code>bun run docs</code> to regenerate.</p>
${content}
  <p id="no-results">No widgets match your search.</p>
</main>
<script>
(function () {
  'use strict';

  // ── Tab switching (event delegation — one listener for all cards) ─────────
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tabs = btn.closest('.tabs');
    if (!tabs) return;
    const tab = btn.dataset.tab;
    tabs.querySelectorAll('.tab-btn').forEach(function (b) {
      const active = b.dataset.tab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    tabs.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
  });

  // ── Search / filter ───────────────────────────────────────────────────────
  const searchEl = document.getElementById('search');
  const noResults = document.getElementById('no-results');
  const navDetails = Array.from(document.querySelectorAll('#sidebar-nav details'));
  const initialOpen = new Map(navDetails.map(function (d) { return [d, d.open]; }));

  searchEl.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.widget').forEach(function (el) {
      const name = (el.dataset.name || '').toLowerCase();
      const show = !q || name.includes(q);
      el.hidden = !show;
      if (show) visible++;
    });
    if (noResults) noResults.style.display = (!q || visible > 0) ? 'none' : 'block';
    document.querySelectorAll('#sidebar-nav li[data-name]').forEach(function (li) {
      const name = (li.dataset.name || '').toLowerCase();
      li.hidden = q ? !name.includes(q) : false;
    });
    navDetails.forEach(function (d) {
      if (!q) {
        d.hidden = false;
        d.open = initialOpen.get(d) || false;
      } else {
        const hasVisible = Array.from(
          d.querySelectorAll('li[data-name]'),
        ).some(function (li) { return !li.hidden; });
        d.hidden = !hasVisible;
        if (hasVisible) d.open = true;
      }
    });
  });

  // ── Scrollspy — highlight the active sidebar link ─────────────────────────
  const anchors = Array.from(
    document.querySelectorAll('main .widget[id], main section[id]'),
  );
  const sideLinks = Array.from(document.querySelectorAll('#sidebar-nav a'));

  const onScroll = function () {
    const scrollY = window.scrollY + 100;
    let activeId = null;
    for (const el of anchors) {
      if (el.offsetTop <= scrollY) activeId = el.id;
    }
    sideLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
</script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-jsx.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-tsx.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-dart.min.js"></script>
</body>
</html>`;
