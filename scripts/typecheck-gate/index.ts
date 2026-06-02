/**
 * Typecheck gate — the standing guarantee that scaffolds ALWAYS emit clean TS.
 *
 * For every skeleton in create-flutter-tsx's catalog it writes a full project to
 * a temp dir (exactly as `bun create flutter-tsx` would), links the freshly-built
 * local `flutter-tsx`, and runs `tsc --noEmit` against the scaffold's own
 * tsconfig. Any type error means a scaffolded app wouldn't compile — a regression
 * that must never ship. Run: `bun run typecheck:gate` (CI runs it on every push).
 */
import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Test-only cross-package import (never shipped) — same pattern as the skeleton
// harness; lets the gate scaffold from the real catalog + templates.
import {
  scaffoldBase,
  scaffoldSkeleton,
  SKELETON_CATALOG,
  type TargetCategory,
} from '../../../create-flutter-tsx/src/scaffold.js';
import {
  appConfig,
  userPackageJson,
  userTsconfig,
} from '../../../create-flutter-tsx/src/templates.js';

const PKG = join(import.meta.dir, '..', '..'); // packages/flutter-tsx
const TSC = join(PKG, 'node_modules', '.bin', 'tsc');

const skeletons: { cat: TargetCategory; name: string }[] = (
  Object.entries(SKELETON_CATALOG) as [TargetCategory, { name: string }[]][]
).flatMap(([cat, list]) => list.map((s) => ({ cat, name: s.name })));

const TARGET_FOR: Record<TargetCategory, string> = {
  mobile: 'ios',
  desktop: 'macos',
  web: 'web',
};

/** Scaffold a full project (as `bun create flutter-tsx` does) into `dir`. */
const scaffoldProject = (
  dir: string,
  name: string,
  cat: TargetCategory,
): void => {
  mkdirSync(join(dir, 'config'), { recursive: true });
  scaffoldBase(dir);
  scaffoldSkeleton(dir, name, cat);
  writeFileSync(
    join(dir, 'config', 'app.ts'),
    appConfig(
      name,
      `com.example.${name.replace(/[^a-z0-9]/g, '')}`,
      TARGET_FOR[cat],
    ),
  );
  writeFileSync(join(dir, 'package.json'), userPackageJson(name));
  writeFileSync(join(dir, 'tsconfig.json'), userTsconfig());
  // Resolve `flutter-tsx` to the freshly-built local package (what users get).
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  symlinkSync(PKG, join(dir, 'node_modules', 'flutter-tsx'), 'dir');
};

const run = (): void => {
  if (!existsSync(join(PKG, 'dist', 'src', 'index.d.ts'))) {
    console.error('flutter-tsx is not built — run `bun run build` first.');
    process.exit(2);
  }
  console.log(`Typechecking ${skeletons.length} scaffolded skeletons…`);

  const broken: { skeleton: string; output: string }[] = [];
  for (const { cat, name } of skeletons) {
    const dir = mkdtempSync(join(tmpdir(), `fsxtc-${cat}-${name}-`));
    try {
      scaffoldProject(dir, name, cat);
      try {
        execFileSync(TSC, ['--noEmit', '-p', join(dir, 'tsconfig.json')], {
          stdio: 'pipe',
        });
      } catch (err) {
        const out = String((err as { stdout?: Buffer }).stdout ?? '').trim();
        broken.push({ skeleton: `${cat}/${name}`, output: out });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  if (broken.length === 0) {
    console.log(
      `✓ typecheck gate: ${skeletons.length}/${skeletons.length} skeletons are tsc-clean`,
    );
    return;
  }
  console.error(`\n✖ typecheck gate: ${broken.length} skeleton(s) fail tsc:\n`);
  for (const { skeleton, output } of broken) {
    console.error(`── ${skeleton} ──\n${output}\n`);
  }
  process.exit(1);
};

run();
