import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { transpileAll } from '@src/transpiler/index.js';
import '../helpers/resemble.js';

// The skeletons being validated live in the sibling create-flutter-tsx
// package. This is a test-only import — flutter-tsx tests are never shipped,
// so it introduces no runtime coupling between the two packages.
import {
  scaffoldSkeleton,
  SKELETON_CATALOG,
  type TargetCategory,
} from '../../../create-flutter-tsx/src/scaffold.js';

const mkTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-skeleton-'));

const DART_BIN = join(homedir(), '.fsx', 'flutter', 'bin', 'dart');
// Tier 2 (dart analyze) is opt-in: it is slower and only meaningful for syntax
// checks here (the temp output is not a resolved Flutter package). Enable with
// FSX_E2E=1 and an installed SDK.
const RUN_TIER2 = process.env.FSX_E2E === '1' && existsSync(DART_BIN);

const collectTsxFiles = (srcDir: string): string[] => [
  ...new Bun.Glob('**/*.tsx').scanSync(srcDir),
];

const readAllDart = (outDir: string): { file: string; code: string }[] =>
  [...new Bun.Glob('**/*.dart').scanSync(outDir)].map((file) => ({
    file,
    code: readFileSync(join(outDir, file), 'utf-8'),
  }));

// Detect un-transpiled JSX that survived into Dart (most often JSX passed as a
// prop value, e.g. `icon={<Icon/>}`). Needs no SDK; applies to every skeleton.
// Must NOT flag Dart generics like `State<MainApp>` or `List<Widget>`, where
// `<` is preceded by an identifier char. JSX leftovers are either self-closing
// (`/>`), closing tags (`</`), or an opening tag followed by an attribute, with
// `<` preceded by a non-identifier char.
const jsxLeftover = (code: string): string | null => {
  if (code.includes('/>')) return '/>';
  if (code.includes('</')) return '</';
  const openTag =
    /(?<![A-Za-z0-9_])<[A-Z][A-Za-z0-9]*\s+[a-z][A-Za-z0-9]*=/.exec(code);
  return openTag ? openTag[0] : null;
};

const allSkeletons: { cat: TargetCategory; name: string }[] = (
  Object.entries(SKELETON_CATALOG) as [TargetCategory, { name: string }[]][]
).flatMap(([cat, skeletons]) => skeletons.map((s) => ({ cat, name: s.name })));

// ── Tier 1: every skeleton transpiles to clean Dart ──────────────────────────

describe('skeleton catalog — transpiles to Dart (Tier 1)', () => {
  for (const { cat, name } of allSkeletons) {
    test(`${cat}/${name} — one Dart file per TSX, no JSX leftovers`, async () => {
      const dir = mkTmp();
      try {
        scaffoldSkeleton(dir, name, cat);
        const srcDir = join(dir, 'src');
        const outDir = join(dir, 'out');

        const tsxCount = collectTsxFiles(srcDir).length;
        expect(tsxCount).toBeGreaterThan(0);

        // Guard: a single-child widget given multiple children now throws
        // (instead of silently dropping them). transpileAll surfacing an error
        // here means a skeleton ships incomplete UI — fail with its name.
        let results;
        try {
          results = await transpileAll(srcDir, outDir);
        } catch (err) {
          throw new Error(`${cat}/${name} failed to transpile: ${String(err)}`);
        }
        expect(results.length).toBe(tsxCount);

        for (const { file, code } of readAllDart(outDir)) {
          const leftover = jsxLeftover(code);
          if (leftover) {
            throw new Error(
              `${name}/${file}: un-transpiled JSX leftover "${leftover}…"`,
            );
          }
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

// ── Tier 1: multi-file skeletons emit cross-file Dart imports ─────────────────

describe('multi-file skeletons — cross-file Dart imports (Tier 1)', () => {
  test('mobile/tabs — App.dart imports its screen files', async () => {
    const dir = mkTmp();
    try {
      scaffoldSkeleton(dir, 'tabs', 'mobile');
      const outDir = join(dir, 'out');
      await transpileAll(join(dir, 'src'), outDir);

      const appDart = readFileSync(join(outDir, 'App.dart'), 'utf-8');
      expect(appDart.split('\n').slice(2).join('\n').trim()).toResemble(`
        import 'package:flutter/material.dart';
        import 'HomeScreen.dart';
        import 'DiscoverScreen.dart';
        import 'SettingsScreen.dart';

        class _FsxTabs0 extends StatefulWidget {
          const _FsxTabs0({super.key});
          @override
          State<_FsxTabs0> createState() => _FsxTabs0State();
        }

        class _FsxTabs0State extends State<_FsxTabs0> {
          int _index = 0;
          @override
          Widget build(BuildContext context) {
            return Scaffold(
              body: IndexedStack(index: _index, children: [HomeScreen(), DiscoverScreen(), SettingsScreen()]),
              bottomNavigationBar: BottomNavigationBar(
                currentIndex: _index,
                onTap: (i) => setState(() => _index = i),
                items: const [BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'), BottomNavigationBarItem(icon: Icon(Icons.explore), label: 'Discover'), BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings')],
              ),
            );
          }
        }

        class MainApp extends StatelessWidget {
          const MainApp({super.key});
          @override
          Widget build(BuildContext context) {
            return MaterialApp(title: 'My App', home: _FsxTabs0());
          }
        }`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── Tier 2: dart analyze, syntax errors only (opt-in: FSX_E2E=1) ──────────────

// Codes that indicate a malformed parse — these are resolution-independent and
// always real. Semantic codes (undefined_class, uri_does_not_exist) are
// dominated by the temp dir not being a resolved Flutter package, so we ignore
// them here; Tier 1 + the real `fsx dev` path cover semantics.
const SYNTAX_ERROR_CODES = [
  'expected_token',
  'missing_identifier',
  'expected_executable',
  'non_type_as_type_argument',
];

describe('skeleton catalog — dart analyze syntax (Tier 2)', () => {
  test.skipIf(!RUN_TIER2)(
    'every skeleton produces syntactically valid Dart',
    async () => {
      // Transpile every skeleton into one tree, then analyze once — a single
      // `dart analyze` invocation is far faster than one per skeleton.
      const root = mkTmp();
      try {
        for (const { cat, name } of allSkeletons) {
          const src = mkTmp();
          scaffoldSkeleton(src, name, cat);
          await transpileAll(join(src, 'src'), join(root, `${cat}_${name}`));
          rmSync(src, { recursive: true, force: true });
        }

        let output = '';
        try {
          execFileSync(DART_BIN, ['analyze', root], { stdio: 'pipe' });
        } catch (err) {
          output = String((err as { stdout?: Buffer }).stdout ?? '');
        }

        const syntaxErrors = output
          .split('\n')
          .filter((line) => SYNTAX_ERROR_CODES.some((c) => line.includes(c)));

        if (syntaxErrors.length > 0) {
          throw new Error(
            `Skeleton syntax errors:\n${syntaxErrors.join('\n')}`,
          );
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
