import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

import { HOOK_PERMISSIONS } from '../flutter/permissions.js';
import { PLUGIN_MAP } from '../generated/plugin-map.js';
import { generateDartFileResult } from './codegen.js';
import { parseFile } from './parser.js';
import { buildGoRouter, discoverRoutes, type RouteDef } from './routing.js';

export interface TranspileResult {
  path: string;
  packages: string[];
  /** Permission capabilities inferred from the plugin hooks the file uses. */
  capabilities: string[];
}

export interface TranspileOptions {
  /** Props (e.g. theme/darkTheme from config/theme.ts) to inject into MaterialApp. */
  materialAppProps?: Record<string, string>;
  /** File-based router (decl + route imports) injected into the MaterialApp file. */
  router?: { decl: string; imports: string[] };
  /** Override the output Dart filename (route files → `<Component>.dart`). */
  outName?: string;
}

export const transpileFile = async (
  tsxPath: string,
  outDir: string,
  options: TranspileOptions = {},
): Promise<TranspileResult> => {
  const parsed = parseFile(tsxPath);

  if (parsed.exports.length === 0) {
    return { path: '', packages: [], capabilities: [] };
  }

  const { code: dartCode, imports } = generateDartFileResult(
    parsed.sourceFile,
    parsed.exports,
    {
      localComponents: parsed.localComponents,
      materialAppProps: options.materialAppProps,
      usesTranslations: parsed.usesTranslations,
      router: options.router,
    },
  );

  const dartFileName = options.outName ?? `${basename(tsxPath, '.tsx')}.dart`;
  const dartPath = join(outDir, dartFileName);

  if (!existsSync(dirname(dartPath))) {
    mkdirSync(dirname(dartPath), { recursive: true });
  }

  writeFileSync(dartPath, dartCode, 'utf-8');

  const packages = collectPackages(imports);
  const capabilities = collectCapabilities(imports);
  return { path: dartPath, packages, capabilities };
};

const FLUTTER_BASE_PACKAGES = new Set([
  'flutter/material.dart',
  'flutter/services.dart',
  'flutter/widgets.dart',
  'flutter/cupertino.dart',
]);

const collectPackages = (imports: Set<string>): string[] => {
  const pubspecDeps = new Set<string>();

  for (const imp of imports) {
    if (!imp.startsWith('package:')) continue;
    const bare = imp.replace('package:', '');
    if (FLUTTER_BASE_PACKAGES.has(bare)) continue;

    for (const plugin of PLUGIN_MAP.values()) {
      if (plugin.pubspecDep && plugin.dartImport.includes(`package:${bare}`)) {
        pubspecDeps.add(plugin.pubspecDep);
        break;
      }
    }
  }

  return [...pubspecDeps];
};

/**
 * Permission capabilities inferred from the plugin packages a file imports —
 * `package:camera` (useCamera) → `camera`, etc. (see HOOK_PERMISSIONS).
 */
const collectCapabilities = (imports: Set<string>): string[] => {
  const capabilities = new Set<string>();

  for (const imp of imports) {
    if (!imp.startsWith('package:')) continue;
    const bare = imp.replace('package:', '');

    for (const plugin of PLUGIN_MAP.values()) {
      if (plugin.dartImport.includes(`package:${bare}`)) {
        for (const cap of HOOK_PERMISSIONS[plugin.tsxName] ?? []) {
          capabilities.add(cap);
        }
        break;
      }
    }
  }

  return [...capabilities];
};

/** Normalizes a `routes="./routes"` prop value to a src-relative dir ("routes"). */
const normalizeRoutesDir = (value: string): string =>
  value.replace(/^\.\//, '').replace(/\/$/, '');

/** Finds the `<MaterialApp routes="…">` dir declared in any src file, or null. */
const findRoutesDir = async (srcDir: string): Promise<string | null> => {
  const files = await Array.fromAsync(
    new Bun.Glob('**/*.tsx').scan({ cwd: srcDir }),
  );
  for (const f of files) {
    const { routesDir } = parseFile(join(srcDir, f));
    if (routesDir) return normalizeRoutesDir(routesDir);
  }
  return null;
};

/**
 * Transpiles the file-based routes tree (the dir declared via
 * `<MaterialApp routes="…">`): each route file → a Dart file named after its
 * exported component, plus the `_fsxRouter` GoRouter decl + route imports to
 * inject into the app's MaterialApp.
 */
const transpileRoutes = async (
  routesDir: string,
  outDir: string,
  options: TranspileOptions,
): Promise<{
  results: TranspileResult[];
  router: TranspileOptions['router'];
}> => {
  if (!existsSync(routesDir)) return { results: [], router: undefined };
  const routeRel = await Array.fromAsync(
    new Bun.Glob('**/*.tsx').scan({ cwd: routesDir }),
  );
  const discovered = discoverRoutes(routeRel);
  if (discovered.length === 0) return { results: [], router: undefined };

  const results: TranspileResult[] = [];
  const routeDefs: RouteDef[] = [];
  const imports: string[] = [];
  for (const { path, file } of discovered) {
    const parsed = parseFile(join(routesDir, file));
    if (parsed.exports.length === 0) continue;
    const component = parsed.exports[0].name;
    results.push(
      await transpileFile(join(routesDir, file), outDir, {
        ...options,
        outName: `${component}.dart`,
      }),
    );
    routeDefs.push({ path, component });
    imports.push(`${component}.dart`);
  }

  return { results, router: { decl: buildGoRouter(routeDefs), imports } };
};

export const transpileAll = async (
  srcDir: string,
  outDir: string,
  options: TranspileOptions = {},
): Promise<TranspileResult[]> => {
  // File-based routing is activated by `<MaterialApp routes="./routes">` — the
  // explicit, visible connection. Transpile that dir first → the router config
  // the app's MaterialApp is rewritten to MaterialApp.router with.
  const routesRel = await findRoutesDir(srcDir);
  const { results: routeResults, router } = routesRel
    ? await transpileRoutes(join(srcDir, routesRel), outDir, options)
    : { results: [], router: undefined };
  const appOptions: TranspileOptions = {
    ...options,
    router: router ?? options.router,
  };

  const glob = new Bun.Glob('**/*.tsx');
  const files = (await Array.fromAsync(glob.scan({ cwd: srcDir }))).filter(
    (f) => !(routesRel && f.startsWith(`${routesRel}/`)),
  );

  const settled = await Promise.allSettled(
    files.map((f) => transpileFile(join(srcDir, f), outDir, appOptions)),
  );

  const written: TranspileResult[] = [...routeResults];
  const errors: unknown[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.path) {
      written.push(result.value);
    } else if (result.status === 'rejected') {
      errors.push(result.reason);
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(
        '[fsx] Transpile error:',
        err instanceof Error ? err.message : String(err),
      );
    }
    throw new Error(`${errors.length} file(s) failed to transpile`);
  }

  return written;
};
