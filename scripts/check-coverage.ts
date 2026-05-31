#!/usr/bin/env bun
/**
 * Enforces line coverage per owned `src/` file.
 *
 * Bun 1.3.x does not enforce `--coverage-threshold` / bunfig `coverageThreshold`
 * (both are no-ops), so this script is the real gate: it runs the suite with
 * coverage, parses the per-file table, and fails if any owned source file is
 * below the threshold. Author scripts and the sibling create-flutter-tsx
 * sources (pulled in by the skeleton harness, covered in their own repo) are
 * not owned by this package and are ignored.
 */
const THRESHOLD = 90; // minimum % line coverage per owned src/ file

// Integration-only files: process orchestration (flutter create / pub get /
// asset generation) that is verified by the lifecycle e2e + project.test.ts
// mock-flutter tests rather than line-covered by unit tests. Documented, not
// silent — each entry carries a rationale.
const ALLOWLIST: Record<string, string> = {
  'src/flutter/project.ts':
    'ensureFlutterProject spawns flutter create/pub get/asset-gen — e2e + mock-flutter tested',
  'src/flutter/runner.ts':
    'FlutterRunner spawns `flutter run`; getMacOSArch shells out to `xcodebuild` only on darwin, so line coverage diverges by OS (macOS covers the xcodebuild path, Linux CI cannot) — verified by mock-flutter tests + e2e, not unit line coverage',
};

const run = Bun.spawnSync(['bun', 'test', '--coverage'], {
  stdout: 'pipe',
  stderr: 'pipe',
});
const output = run.stdout.toString() + run.stderr.toString();

if (run.exitCode !== 0) {
  process.stdout.write(output);
  console.error('\n✖ tests failed');
  process.exit(1);
}

interface Row {
  path: string;
  lines: number;
}

const rows: Row[] = [];
for (const line of output.split('\n')) {
  if (!line.includes('|')) continue;
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length < 3) continue;
  const path = cols[0];
  const lines = Number(cols[2]);
  if (!path.startsWith('src/') || Number.isNaN(lines)) continue;
  rows.push({ path, lines });
}

const failures = rows.filter(
  (r) => !(r.path in ALLOWLIST) && r.lines < THRESHOLD,
);

if (failures.length > 0) {
  console.error(`\n✖ coverage gate: files below ${THRESHOLD}% line coverage:`);
  for (const f of failures) {
    console.error(`  ${f.path} — ${f.lines.toFixed(2)}%`);
  }
  process.exit(1);
}

const allowlisted = rows.filter((r) => r.path in ALLOWLIST);
console.log(
  `✓ coverage gate: ${rows.length - allowlisted.length} owned src/ files ≥ ${THRESHOLD}% lines` +
    (allowlisted.length
      ? ` (${allowlisted.length} integration file(s) allowlisted)`
      : ''),
);
