#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { ApiJson, EnumEntity, TypeDef, WidgetDef } from './api-types';
import { buildDefs } from './build-defs';
import { buildCodegenMap, buildRecipes } from './build-recipes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

const FLUTTER_PATH = join(process.env.HOME ?? '', '.fsx', 'flutter');
const DART_BIN = join(FLUTTER_PATH, 'bin', 'dart');
const EXTRACTOR_DIR = join(__dirname, '..', 'dart-extractor');
const API_JSON_PATH = join(ROOT, 'ref', 'api.json');
const DERIVED_DIR = join(ROOT, 'ref', 'derived');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  const rel = filePath.replace(ROOT + '/', '');
  console.log(`  Written: ${rel}`);
}

async function runDartExtractor(): Promise<void> {
  console.log('Stage 1: Running Dart extractor…');

  const pubLock = join(EXTRACTOR_DIR, '.dart_tool', 'package_config.json');
  if (!existsSync(pubLock)) {
    console.log('  Running dart pub get…');
    const pubGet = Bun.spawn([DART_BIN, 'pub', 'get'], {
      cwd: EXTRACTOR_DIR,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const exitCode = await pubGet.exited;
    if (exitCode !== 0)
      throw new Error(`dart pub get failed (exit ${exitCode})`);
  }

  const proc = Bun.spawn(
    [
      DART_BIN,
      'run',
      'bin/extract.dart',
      '--flutter-path',
      FLUTTER_PATH,
      '--output',
      API_JSON_PATH,
    ],
    { cwd: EXTRACTOR_DIR, stdout: 'inherit', stderr: 'inherit' },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0)
    throw new Error(`Dart extractor failed (exit ${exitCode})`);
}

function writeDerived(
  widgets: WidgetDef[],
  enums: EnumEntity[],
  types: TypeDef[],
): void {
  console.log('Stage 2: Writing ref/derived/…');
  ensureDir(DERIVED_DIR);

  writeJson(join(DERIVED_DIR, 'widgets.json'), widgets);
  writeJson(join(DERIVED_DIR, 'enums.json'), enums);
  writeJson(join(DERIVED_DIR, 'types.json'), types);

  const { hooks, functions, plugins } = buildRecipes();
  writeJson(join(DERIVED_DIR, 'hooks.json'), hooks);
  writeJson(join(DERIVED_DIR, 'functions.json'), functions);
  writeJson(join(DERIVED_DIR, 'plugins.json'), plugins);
  writeJson(join(DERIVED_DIR, 'plugins-codegen.json'), buildCodegenMap());
}

async function runGenerateTypes(): Promise<void> {
  console.log('Stage 3: Generating TS types…');
  const { run } = await import('../generate-types');
  await run();
}

async function main(): Promise<void> {
  if (!existsSync(DART_BIN)) {
    throw new Error(
      `Flutter SDK not found at ${FLUTTER_PATH}\nRun \`fsx install\` first.`,
    );
  }

  await runDartExtractor();

  const api: ApiJson = JSON.parse(await Bun.file(API_JSON_PATH).text());
  const { widgets, enums, types } = buildDefs(api);

  console.log(
    `  Processed ${widgets.length} widgets, ${enums.length} enums, ${types.length} types`,
  );

  writeDerived(widgets, enums, types);
  await runGenerateTypes();

  console.log('\nDone.');
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
