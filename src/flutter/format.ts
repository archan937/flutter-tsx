import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { homedir, tmpdir } from 'os';
import { dirname, join } from 'path';

/**
 * Resolve the `dart` binary. Prefer the one next to the provided Flutter binary
 * (so it matches the installed SDK), then PATH, then the fsx-managed SDK.
 */
const resolveDartBin = (flutterBin?: string): string | null => {
  if (flutterBin) {
    const sibling = join(dirname(flutterBin), 'dart');
    if (existsSync(sibling)) return sibling;
  }
  const onPath = Bun.which('dart');
  if (onPath) return onPath;
  const managed = join(homedir(), '.fsx/flutter/bin/dart');
  return existsSync(managed) ? managed : null;
};

/**
 * Runs `dart format` over a directory of generated Dart in place, so the
 * shipped output matches `dart format` conventions (the transpiler emits
 * readable-but-unformatted Dart; this is the single normalization point).
 * No-op when no `dart` binary is available — formatting is a polish step, never
 * a hard dependency of transpilation. Returns whether formatting ran.
 */
export const formatDartDir = async (
  dir: string,
  flutterBin?: string,
): Promise<boolean> => {
  const dartBin = resolveDartBin(flutterBin);
  if (!dartBin || !existsSync(dir)) return false;
  const result = await Bun.$`${dartBin} format ${dir}`.nothrow().quiet();
  return result.exitCode === 0;
};

/**
 * Formats a single Dart snippet via a temp file (`dart format` has no stdin
 * mode). Returns the input unchanged when no `dart` binary is available or
 * formatting fails — used for docs/api-reference code samples.
 */
export const formatDartSource = async (source: string): Promise<string> => {
  const dartBin = resolveDartBin();
  if (!dartBin) return source;
  const dir = mkdtempSync(join(tmpdir(), 'fsxfmt-'));
  const file = join(dir, 'snippet.dart');
  try {
    writeFileSync(file, source);
    const result = await Bun.$`${dartBin} format ${file}`.nothrow().quiet();
    return result.exitCode === 0 ? readFileSync(file, 'utf-8') : source;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
