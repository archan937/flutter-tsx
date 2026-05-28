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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Output into docs/ alongside README.html
const outPath = join(__dirname, '../docs/api-reference.html');

const run = (): void => {
  console.log('[docs] Building API reference…');
  const { html, widgetCount, enumCount, typeCount, pluginCount, failures } =
    buildApiReference();

  writeFileSync(outPath, html, 'utf-8');

  console.log(
    `[docs] ✓ ${widgetCount} widgets · ${pluginCount} plugins · ${typeCount} types · ${enumCount} enums · 2 hooks`,
  );
  console.log(`[docs] → ${outPath}`);

  if (failures > 0) {
    console.warn(
      `[docs] ⚠ ${failures} widget(s) fell back to bare constructor`,
    );
  }
};

run();
