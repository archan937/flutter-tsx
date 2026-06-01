/**
 * flutter analyze gate — the trust mechanism for generated Dart.
 *
 * For every generated construct (plugin hook, plugin widget, feature-function,
 * and every gallery example) it synthesizes a minimal TSX usage, transpiles it
 * to Dart, drops the result into a single real Flutter project that depends on
 * every plugin, and runs `flutter analyze` once. Any analyzer error means the
 * codegen emits Dart that does NOT conform to the real Flutter/plugin API.
 *
 * Run: `bun run analyze:gate` (needs the SDK from `fsx install` + network for
 * `flutter pub get`). CI runs it on macOS where the SDK is cached.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { generateDartFile } from '../../src/transpiler/codegen.js';
import { parseSource } from '../../src/transpiler/parser.js';
import { EXAMPLES } from '../api-reference/examples-data.js';
import {
  type HookDef,
  synthHookComponent,
  synthWidgetComponent,
  type WidgetPlugin,
} from './synth.js';

interface PluginEntry {
  tsxName: string;
  surface: string;
  pubspecDep?: string;
  tsxExample: string;
}

const REF = join(import.meta.dir, '../../ref/derived');
const FLUTTER = join(homedir(), '.fsx/flutter/bin/flutter');

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(REF, file), 'utf8')) as T;

interface GateCase {
  name: string;
  tsx: string;
}

const buildCases = (): { cases: GateCase[]; deps: Set<string> } => {
  const plugins = readJson<PluginEntry[]>('plugins.json');
  const hooks = readJson<HookDef[]>('hooks.json');
  const deps = new Set<string>();
  for (const plugin of plugins) {
    if (plugin.pubspecDep) deps.add(plugin.pubspecDep);
  }
  // Hooks need provider/go_router too (examples use stores/routing).
  deps.add('provider: ^6.1.2');
  deps.add('go_router: ^14.6.2');
  deps.add('http: ^1.2.2');

  const cases: GateCase[] = [];
  let index = 0;
  for (const hook of hooks) {
    cases.push({
      name: `hook_${hook.tsxHook}`,
      tsx: synthHookComponent(hook, index++),
    });
  }
  for (const plugin of plugins) {
    if (plugin.surface !== 'widget' || plugin.tsxName === 'Router') continue;
    const widget: WidgetPlugin = {
      tsxName: plugin.tsxName,
      tsxExample: plugin.tsxExample,
    };
    cases.push({
      name: `widget_${plugin.tsxName}`,
      tsx: synthWidgetComponent(widget, index++),
    });
  }
  for (const example of EXAMPLES) {
    cases.push({ name: `example_${example.id}`, tsx: example.tsx });
  }
  return { cases, deps };
};

const transpile = (tsx: string): string => {
  const { sourceFile, exports } = parseSource(tsx);
  return generateDartFile(sourceFile, exports);
};

const writeProject = (dir: string, deps: Set<string>): void => {
  // Use unconstrained versions: the gate proves API conformance against the
  // current published plugin, independent of recipe pin drift.
  const packages = new Set<string>();
  for (const dep of deps) packages.add(dep.split(':')[0].trim());
  const depLines = [...packages].map((pkg) => `  ${pkg}: any`).join('\n');
  writeFileSync(
    join(dir, 'pubspec.yaml'),
    `name: fsxgate
description: analyze gate
publish_to: none
environment:
  sdk: '>=3.4.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
${depLines}
flutter:
  uses-material-design: true
`,
  );
};

const run = async (): Promise<void> => {
  if (!existsSync(FLUTTER)) {
    console.error(`flutter SDK not found at ${FLUTTER} — run \`fsx install\``);
    process.exit(2);
  }
  const dir = join(tmpdir(), 'fsxgate');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'lib', 'cases'), { recursive: true });

  const { cases, deps } = buildCases();
  writeProject(dir, deps);

  const fileFor = new Map<string, string>();
  for (const gateCase of cases) {
    const dart = transpile(gateCase.tsx);
    const path = join('lib', 'cases', `${gateCase.name}.dart`);
    writeFileSync(join(dir, path), dart);
    fileFor.set(path, gateCase.name);
  }
  // Reference every case so unused imports/classes are still analyzed.
  writeFileSync(
    join(dir, 'lib', 'main.dart'),
    cases.map((c) => `export 'cases/${c.name}.dart';`).join('\n') + '\n',
  );

  console.log(`Analyzing ${cases.length} generated Dart cases…`);
  await Bun.$`${FLUTTER} pub get`.cwd(dir).quiet();
  const result = await Bun.$`${FLUTTER} analyze --no-pub`
    .cwd(dir)
    .nothrow()
    .quiet();
  const output = result.stdout.toString() + result.stderr.toString();

  const errorLines = output
    .split('\n')
    .filter((line) => /^\s*(error|warning)\s/i.test(line.trim()));
  const broken = new Set<string>();
  for (const line of errorLines) {
    for (const [path, name] of fileFor) {
      if (line.includes(path)) broken.add(name);
    }
  }

  if (errorLines.length === 0) {
    console.log(`✓ analyze gate: ${cases.length}/${cases.length} cases clean`);
    return;
  }
  console.error(`\n✖ analyze gate: ${broken.size} broken case(s):`);
  for (const name of [...broken].sort()) console.error(`  - ${name}`);
  console.error('\n--- analyzer output ---\n' + errorLines.join('\n'));
  process.exit(1);
};

await run();
