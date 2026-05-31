#!/usr/bin/env bun
/**
 * generate-api-reference.ts
 *
 * Generates /api-reference.html from:
 *   ref/derived/widgets.json   — Flutter widget catalog (props, slots, categories)
 *   ref/derived/enums.json     — Dart enums as TSX string-literal unions
 *   ref/derived/types.json     — Value & utility types
 *   ref/derived/plugins.json   — Native plugin capabilities (hooks, widgets, functions)
 *   ref/api.json               — doc strings + library (material/cupertino)
 *
 * Each widget gets: cleaned doc, full props table, synthesized TSX example,
 * and the real transpiler's Dart counterpart.
 *
 * Run:  bun run docs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { buildApiReference } from './api-reference/build';
import { landingHtml } from './api-reference/landing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docsDir = join(__dirname, '../docs');
const outPath = join(docsDir, 'api-reference.html');
const landingPath = join(docsDir, 'index.html');

const run = (): void => {
  console.log('[docs] Building API reference…');
  const {
    html,
    widgetCount,
    enumCount,
    typeCount,
    pluginCount,
    hookCount,
    failures,
  } = buildApiReference();

  writeFileSync(outPath, html, 'utf-8');

  // Landing page stats are generated from the same live counts (single source
  // of truth) so they never drift from the reference.
  writeFileSync(
    landingPath,
    landingHtml({ widgetCount, pluginCount, hookCount, enumCount, typeCount }),
    'utf-8',
  );

  console.log(
    `[docs] ✓ ${widgetCount} widgets · ${pluginCount} plugins · ${typeCount} types · ${enumCount} enums · ${hookCount} hooks & core APIs`,
  );
  console.log(`[docs] → ${outPath}`);
  console.log(`[docs] → ${landingPath}`);

  if (failures > 0) {
    console.warn(
      `[docs] ⚠ ${failures} widget(s) fell back to bare constructor`,
    );
  }
};

run();
