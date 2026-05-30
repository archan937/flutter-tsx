import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

import { HOOK_PERMISSIONS } from '../flutter/permissions.js';
import { PLUGIN_MAP } from '../generated/plugin-map.js';
import { generateDartFileResult } from './codegen.js';
import { parseFile } from './parser.js';

export interface TranspileResult {
  path: string;
  packages: string[];
  /** Permission capabilities inferred from the plugin hooks the file uses. */
  capabilities: string[];
}

export interface TranspileOptions {
  /** Props (e.g. theme/darkTheme from config/theme.ts) to inject into MaterialApp. */
  materialAppProps?: Record<string, string>;
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
    },
  );

  const inputBaseName = basename(tsxPath, '.tsx');
  const dartFileName = `${inputBaseName}.dart`;
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

export const transpileAll = async (
  srcDir: string,
  outDir: string,
  options: TranspileOptions = {},
): Promise<TranspileResult[]> => {
  const glob = new Bun.Glob('**/*.tsx');
  const files = await Array.fromAsync(glob.scan({ cwd: srcDir }));

  const settled = await Promise.allSettled(
    files.map((f) => transpileFile(join(srcDir, f), outDir, options)),
  );

  const written: TranspileResult[] = [];
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
