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
<link rel="icon" type="image/png" href="./icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
/* ── Design tokens (shared with the landing page) ─── */
:root {
  --react:#61dafb; --flutter:#54a4ff; --violet:#a78bfa;
  --bg:#07090f; --panel:rgba(20,26,38,.62);
  --line:rgba(120,150,200,.16); --line-soft:rgba(120,150,200,.09);
  --text:#e8eef7; --muted:#9aa6bb; --dim:#6f7c93;
  --grad:linear-gradient(115deg,#61dafb 0%,#54a4ff 48%,#a78bfa 100%);
  --display:"Bricolage Grotesque",system-ui,sans-serif;
  --body:"Hanken Grotesk",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",monospace;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body { display: flex; font-family: var(--body); color: var(--text); line-height: 1.6;
  background: var(--bg); min-height: 100vh; -webkit-font-smoothing: antialiased; }

/* ── Atmosphere ─── */
.bg-layer { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
.bg-grid { background-image:
    linear-gradient(var(--line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%); }
.bg-glow { background:
    radial-gradient(900px 520px at 50% -160px, rgba(97,218,251,.16), transparent 70%),
    radial-gradient(820px 520px at 95% 4%, rgba(167,139,250,.12), transparent 66%); }

/* ── Sidebar ─── */
#sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto;
  width: 250px; min-width: 250px; flex-shrink: 0; padding: 18px 12px 24px; font-size: 13px;
  background: linear-gradient(180deg, rgba(17,21,31,.92), rgba(11,14,20,.84));
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--line); }
.sb-brand { display: flex; align-items: center; gap: 10px; text-decoration: none;
  color: var(--text); font-family: var(--mono); font-weight: 700; font-size: .95rem;
  letter-spacing: -.02em; padding: 4px 6px 16px; }
.sb-brand .mark { width: 28px; height: 28px; border-radius: 7px; object-fit: cover; display: block;
  border: 1px solid rgba(97,218,251,.85); box-shadow: 0 0 12px rgba(167,139,250,.6), 0 4px 12px rgba(167,139,250,.3); }
.sb-brand b { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
#search { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px;
  font-family: var(--body); font-size: 13px; margin-bottom: 10px; outline: none;
  background: rgba(7,9,15,.6); color: var(--text); }
#search::placeholder { color: var(--dim); }
#search:focus { border-color: var(--flutter); box-shadow: 0 0 0 2px rgba(84,164,255,.18); }
.meta-info { font-family: var(--mono); font-size: 10.5px; color: var(--dim); margin-bottom: 12px; padding: 0 2px; }

/* ── Sidebar accordion ─── */
details { margin-bottom: 2px; }
details > summary {
  cursor: pointer; list-style: none; display: flex; align-items: center;
  padding: 6px 8px; border-radius: 7px; font-weight: 600; color: var(--muted);
  user-select: none; gap: 6px; }
details > summary:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > summary::-webkit-details-marker { display: none; }
details > summary::before {
  content: '▶'; font-size: 8px; color: var(--dim); flex-shrink: 0;
  transition: transform .18s; display: inline-block; width: 10px; }
details[open] > summary::before { transform: rotate(90deg); }
.nav-count { font-weight: 400; color: var(--dim); font-size: 11px; margin-left: auto; font-family: var(--mono); }
details > ul { list-style: none; padding: 2px 0 4px 18px; }
details > ul li { margin: 1px 0; }
details > ul li a {
  display: block; padding: 3px 8px; border-radius: 6px; color: var(--muted);
  text-decoration: none; font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; transition: background .12s, color .12s; }
details > ul li a:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > ul li a.active { background: rgba(97,218,251,.12); color: var(--react); font-weight: 600; }

/* ── Main content ─── */
main { flex: 1; max-width: 920px; padding: 48px 56px; min-width: 0; }
h1 {
  font-family: var(--display); font-size: 36px; font-weight: 800; letter-spacing: -.03em; margin-bottom: 8px;
  background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.subtitle { color: var(--muted); margin-bottom: 40px; font-size: 15px; }
.subtitle code { font-family: var(--mono); font-size: .9em; background: rgba(255,255,255,.06); padding: .1em .4em; border-radius: 5px; color: var(--react); }
h2 { font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -.02em;
  margin: 56px 0 22px; padding-bottom: 10px; border-bottom: 1px solid var(--line); color: var(--text); }
h2:first-of-type { margin-top: 0; }

/* ── Widget card ─── */
.widget { border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px;
  margin-bottom: 22px; scroll-margin-top: 20px; background: var(--panel);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  transition: border-color .18s, box-shadow .18s; }
.widget:hover { border-color: rgba(97,218,251,.3); box-shadow: 0 14px 36px rgba(84,164,255,.1); }
.widget[hidden] { display: none; }
.widget h3 { font-family: var(--display); font-size: 17px; font-weight: 700; letter-spacing: -.01em;
  margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--text); }
p.doc { color: var(--muted); font-size: 14px; margin-bottom: 14px; }

/* ── Example card ─── */
.example-card h3 { font-size: 18px; }

/* ── Badges ─── */
.badge { font-family: var(--mono); font-size: 10.5px; font-weight: 600; padding: 3px 9px;
  border-radius: 999px; text-transform: lowercase; }
.badge-lib { background: rgba(84,164,255,.14); color: var(--flutter); }
.badge-cat { background: rgba(255,255,255,.05); color: var(--muted); }
.badge-pkg { background: rgba(63,208,122,.14); color: #3fd07a; }

/* ── Props table ─── */
.props { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
.props th { text-align: left; padding: 8px 11px; background: rgba(255,255,255,.03);
  border-bottom: 1px solid var(--line); font-weight: 600; color: var(--muted); }
.props td { padding: 7px 11px; border-bottom: 1px solid var(--line-soft); vertical-align: top;
  color: var(--text); }
.props td:first-child { font-family: var(--mono); font-size: 12px; color: var(--flutter); }
.props td:nth-child(2), .props td:nth-child(3) { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.req { color: #ff7b9c; font-weight: 700; text-align: center; }

/* ── Tabs ─── */
.tabs { margin-top: 14px; border: 1px solid var(--line); border-radius: 11px; overflow: hidden; background: rgba(7,9,15,.5); }
.tab-btns { display: flex; background: rgba(255,255,255,.02); border-bottom: 1px solid var(--line); }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -1px; padding: 9px 18px; cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--muted); transition: color .15s; letter-spacing: .04em; }
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--react); border-bottom-color: var(--react); }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
pre { margin: 0; background: transparent; padding: 18px; overflow-x: auto; white-space: pre; word-wrap: normal; }
code { font-family: var(--mono); font-size: 12.5px; line-height: 1.65; color: var(--text); }

/* ── Nested sidebar accordion (Widgets > categories, Native Plugins > domains) ─── */
details details { margin: 1px 0; }
details details > summary { font-size: 12px; font-weight: 500; padding: 4px 8px; }
details details > ul { padding-left: 24px; }

/* ── Enum values list ─── */
.enum-values { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; }
.enum-values li code { background: rgba(255,255,255,.05); border: 1px solid var(--line); border-radius: 6px;
  padding: 3px 9px; font-size: 12px; }

/* ── No-results message ─── */
#no-results { display: none; padding: 32px; text-align: center; color: var(--dim); font-size: 15px; }

/* ── Prism.js token colours (matches the landing syntax palette) ─── */
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--dim); font-style: italic; }
.token.keyword, .token.rule, .token.important, .token.atrule { color: #ff7b9c; }
.token.string, .token.char, .token.attr-value, .token.regex { color: #9ce0ff; }
.token.function { color: #d2a8ff; }
.token.class-name { color: #ffb877; }
.token.number, .token.boolean, .token.builtin { color: #79c0ff; }
.token.operator, .token.entity, .token.url { color: var(--text); }
.token.punctuation { color: var(--muted); }
.token.tag, .token.selector { color: #7ee7b0; }
.token.attr-name, .token.property { color: #79c0ff; }
.token.constant, .token.symbol { color: #ffb877; }
.token.deleted { color: #ff7b9c; }
.token.inserted { color: #7ee7b0; }
.token.namespace { opacity: 0.7; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
</style>
</head>
<body>
<div class="bg-layer bg-grid"></div>
<div class="bg-layer bg-glow"></div>
<aside id="sidebar">
  <a class="sb-brand" href="./index.html"><img class="mark" src="./icon.png" alt="flutter.tsx logo" width="28" height="28"><span>flutter<b>.tsx</b></span></a>
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
