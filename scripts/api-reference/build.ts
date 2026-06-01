import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type {
  EnumEntity,
  PluginDef,
  PluginDomain,
  TypeDef,
  WidgetCategory,
  WidgetDef,
} from '../define/api-types';
import { formatDartSource } from '../../src/flutter/format';
import { generateDartFile } from '../../src/transpiler/codegen';
import { parseSource } from '../../src/transpiler/parser';
import { EXAMPLES } from './examples-data';
import { synthesizeTsx } from './synthesize';
import {
  DOMAIN_LABELS,
  CORE_APIS,
  enumSection,
  examplesSection,
  hooksSection,
  pageShell,
  pluginSection,
  type RenderedExample,
  typeSection,
  widgetSection,
} from './render';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const refDir = join(__dirname, '../../ref');

// ─── Data loading ─────────────────────────────────────────────────────────────

interface ApiEntity {
  family: 'widget' | 'enum';
  name: string;
  library: string;
  doc?: string;
}

interface ApiJson {
  entities: ApiEntity[];
  _meta?: { frameworkVersion?: string; dartSdkVersion?: string };
}

const loadJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf-8')) as T;

// ─── Dart extraction ──────────────────────────────────────────────────────────

const extractBuildReturn = (dartFile: string): string => {
  const match = dartFile.match(/    return ([\s\S]+?);\n  }/);
  return match?.[1]?.trim() ?? '';
};

const transpileToExample = (widgetName: string, tsx: string): string => {
  const src = `export function Example() { return ${tsx}; }`;
  try {
    const { sourceFile, exports } = parseSource(src, 'example.tsx');
    const dart = generateDartFile(sourceFile, exports);
    return extractBuildReturn(dart) || `${widgetName}()`;
  } catch {
    return `${widgetName}()`;
  }
};

/**
 * Transpile a full component TSX string into a complete Dart class string.
 * Returns an error comment string if transpilation fails.
 */
const transpileExampleFull = (id: string, tsx: string): string => {
  try {
    const { sourceFile, exports } = parseSource(tsx, `${id}.tsx`);
    return generateDartFile(sourceFile, exports);
  } catch (err) {
    return `// Transpilation failed for ${id}: ${String(err)}`;
  }
};

// ─── Plugin domain ordering ───────────────────────────────────────────────────

const PLUGIN_DOMAIN_ORDER: PluginDomain[] = [
  'media',
  'maps-location',
  'storage-data',
  'security',
  'files-assets',
  'device-system',
  'web-networking',
  'auth-payments',
  'navigation',
  'utility',
];

// ─── Build ────────────────────────────────────────────────────────────────────

interface BuildResult {
  html: string;
  widgetCount: number;
  enumCount: number;
  typeCount: number;
  pluginCount: number;
  hookCount: number;
  failures: number;
  flutterVersion: string;
  dartVersion: string;
}

export const buildApiReference = async (): Promise<BuildResult> => {
  const widgets = loadJson<WidgetDef[]>(join(refDir, 'derived/widgets.json'));
  const enums = loadJson<EnumEntity[]>(join(refDir, 'derived/enums.json'));
  const types = loadJson<TypeDef[]>(join(refDir, 'derived/types.json'));
  const plugins = loadJson<PluginDef[]>(join(refDir, 'derived/plugins.json'));
  const api = loadJson<ApiJson>(join(refDir, 'api.json'));

  // Build lookups from ref/api.json (authoritative for library + doc)
  const docMap = new Map<string, string>();
  const libraryMap = new Map<string, string>();
  for (const entity of api.entities) {
    libraryMap.set(entity.name, entity.library);
    if (entity.family === 'widget' && entity.doc) {
      docMap.set(entity.name, entity.doc);
    }
  }

  // Group widgets by category
  const categoryOrder: WidgetCategory[] = [
    'layout',
    'input',
    'display',
    'navigation',
    'other',
  ];
  const byCategory = new Map<WidgetCategory, WidgetDef[]>();
  for (const cat of categoryOrder) byCategory.set(cat, []);
  for (const widget of widgets) {
    byCategory.get(widget.category)?.push(widget);
  }

  // Group plugins by domain
  const byDomain = new Map<PluginDomain, PluginDef[]>();
  for (const domain of PLUGIN_DOMAIN_ORDER) byDomain.set(domain, []);
  for (const plugin of plugins) {
    byDomain.get(plugin.domain)?.push(plugin);
  }

  let failures = 0;
  const sections: string[] = [];

  // Examples section — Dart is produced by the transpiler, not hand-authored,
  // then run through `dart format` so the docs show idiomatic, formatted Dart.
  const renderedExamples: RenderedExample[] = await Promise.all(
    EXAMPLES.map(async (ex) => ({
      ...ex,
      dart: await formatDartSource(transpileExampleFull(ex.id, ex.tsx)),
    })),
  );
  sections.push(examplesSection(renderedExamples));

  // Hooks section (before Widgets)
  sections.push(hooksSection());

  // Native Plugins section (before Widgets, grouped by domain)
  const domainSections = PLUGIN_DOMAIN_ORDER.flatMap((domain) => {
    const group = byDomain.get(domain) ?? [];
    if (group.length === 0) return [];
    const label = DOMAIN_LABELS[domain];
    const articles = group.map((p) => pluginSection(p)).join('\n');
    return [
      `<section id="plugins-${domain}">\n<h3>${label} (${group.length})</h3>\n${articles}\n</section>`,
    ];
  });
  if (domainSections.length > 0) {
    sections.push(
      `<section id="native-plugins">\n<h2>Native Plugins (${plugins.length})</h2>\n${domainSections.join('\n')}\n</section>`,
    );
  }

  // One <section> per widget category
  for (const cat of categoryOrder) {
    const group = byCategory.get(cat) ?? [];
    if (group.length === 0) continue;

    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    const articles = group.map((widget) => {
      const tsx = synthesizeTsx(widget);
      const tsxSrc = `export function Example() {\n  return ${tsx};\n}`;
      const dart = transpileToExample(widget.name, tsx);
      if (dart === `${widget.name}()` && tsx !== `<${widget.name} />`) {
        failures++;
      }
      return widgetSection(
        widget,
        docMap.get(widget.name) ?? '',
        libraryMap.get(widget.name) ?? 'material',
        tsxSrc,
        dart,
      );
    });

    sections.push(
      `<section id="${cat}">\n<h2>${label} (${group.length})</h2>\n${articles.join('\n')}\n</section>`,
    );
  }

  // Enums section (was "Family Types")
  const enumArticles = enums.map((en) => enumSection(en)).join('\n');
  sections.push(
    `<section id="enums">\n<h2>Enums (${enums.length})</h2>\n${enumArticles}\n</section>`,
  );

  // Types section (was "Value & Utility Types"), grouped by library
  const typesByLib = new Map<string, TypeDef[]>();
  for (const typeDef of types) {
    const existing = typesByLib.get(typeDef.library) ?? [];
    existing.push(typeDef);
    typesByLib.set(typeDef.library, existing);
  }
  const typeLibOrder = [
    'material',
    'services',
    'foundation',
    'cupertino',
    'physics',
  ];
  const typeSubsections = typeLibOrder
    .filter((lib) => typesByLib.has(lib))
    .map((lib) => {
      const group = typesByLib.get(lib) ?? [];
      const articles = group.map((t) => typeSection(t)).join('\n');
      return `<section id="types-${lib}">\n<h3>${lib} (${group.length})</h3>\n${articles}\n</section>`;
    });
  if (typeSubsections.length > 0) {
    sections.push(
      `<section id="types">\n<h2>Types (${types.length})</h2>\n${typeSubsections.join('\n')}\n</section>`,
    );
  }

  // ── Sidebar accordion nav ──────────────────────────────────────────────────
  const exampleLinks = renderedExamples
    .map(
      (ex) =>
        `<li data-name="${ex.id}"><a href="#ex-${ex.id}">${ex.title}</a></li>`,
    )
    .join('\n');

  // Widgets: nested details per category
  const catDetailsItems = categoryOrder
    .map((cat) => {
      const group = byCategory.get(cat) ?? [];
      if (group.length === 0) return '';
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const links = group
        .map(
          (w) =>
            `<li data-name="${w.name}"><a href="#${w.name}">${w.name}</a></li>`,
        )
        .join('\n');
      const isOpen = cat === 'layout' || cat === 'input' || cat === 'display';
      return `<details${isOpen ? ' open' : ''}>
<summary>${label}<span class="nav-count">${group.length}</span></summary>
<ul>${links}</ul>
</details>`;
    })
    .filter(Boolean)
    .join('\n');

  const widgetNavDetails = `<details open>
<summary>Widgets<span class="nav-count">${widgets.length}</span></summary>
${catDetailsItems}
</details>`;

  // Hooks & Core APIs (from the same CORE_APIS source as the section).
  const hookNavLinks = CORE_APIS.map((h) => {
    const id = h.name.split(' ')[0];
    return `<li data-name="${h.name}"><a href="#${id}">${h.name}</a></li>`;
  }).join('\n');
  const hooksNavDetails = `<details>
<summary>Hooks &amp; Core APIs<span class="nav-count">${CORE_APIS.length}</span></summary>
<ul>
${hookNavLinks}
</ul>
</details>`;

  // Native Plugins: nested details per domain
  const pluginDomainDetails = PLUGIN_DOMAIN_ORDER.flatMap((domain) => {
    const group = byDomain.get(domain) ?? [];
    if (group.length === 0) return [];
    const label = DOMAIN_LABELS[domain];
    const links = group
      .map(
        (p) =>
          `<li data-name="${p.tsxName}"><a href="#${p.tsxName}">${p.tsxName}</a></li>`,
      )
      .join('\n');
    return [
      `<details>
<summary>${label}<span class="nav-count">${group.length}</span></summary>
<ul>${links}</ul>
</details>`,
    ];
  }).join('\n');

  const pluginsNavDetails = `<details>
<summary>Native Plugins<span class="nav-count">${plugins.length}</span></summary>
${pluginDomainDetails}
</details>`;

  // Enums
  const enumLinks = enums
    .map(
      (en) =>
        `<li data-name="${en.name}"><a href="#${en.name}">${en.name}</a></li>`,
    )
    .join('\n');

  const enumsNavDetails = `<details>
<summary>Enums<span class="nav-count">${enums.length}</span></summary>
<ul>${enumLinks}</ul>
</details>`;

  // Types: nested details per library
  const typeNavLinks = typeLibOrder
    .filter((lib) => typesByLib.has(lib))
    .map((lib) => {
      const group = typesByLib.get(lib) ?? [];
      const links = group
        .map(
          (t) =>
            `<li data-name="${t.name}"><a href="#${t.name}">${t.name}</a></li>`,
        )
        .join('\n');
      return `<details>
<summary>${lib}<span class="nav-count">${group.length}</span></summary>
<ul>${links}</ul>
</details>`;
    })
    .join('\n');

  const typesNavDetails =
    types.length > 0
      ? `<details>
<summary>Types<span class="nav-count">${types.length}</span></summary>
${typeNavLinks}
</details>`
      : '';

  const navHtml = [
    `<details open>\n<summary>Examples<span class="nav-count">${renderedExamples.length}</span></summary>\n<ul>${exampleLinks}</ul>\n</details>`,
    hooksNavDetails,
    pluginsNavDetails,
    widgetNavDetails,
    enumsNavDetails,
    typesNavDetails,
  ]
    .filter(Boolean)
    .join('\n');

  const flutterVersion = api._meta?.frameworkVersion ?? '3';
  const dartVersion = api._meta?.dartSdkVersion ?? '';

  const html = pageShell(sections.join('\n'), navHtml, {
    widgets: widgets.length,
    enums: enums.length,
    types: types.length,
    plugins: plugins.length,
    hooks: CORE_APIS.length,
    flutterVersion,
  });

  return {
    html,
    widgetCount: widgets.length,
    enumCount: enums.length,
    typeCount: types.length,
    pluginCount: plugins.length,
    hookCount: CORE_APIS.length,
    failures,
    flutterVersion,
    dartVersion,
  };
};
