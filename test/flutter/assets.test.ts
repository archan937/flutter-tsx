import * as loggerModule from '@src/cli/utils/logger.js';
import {
  detectAssets,
  generateAssets,
  hashFile,
  ICON_SLOTS,
  readPngDimensions,
} from '@src/flutter/assets.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMinimalPng = (width: number, height: number): Uint8Array => {
  const buf = new Uint8Array(24);
  // PNG signature (8 bytes)
  buf.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  // IHDR chunk length (4 bytes, big-endian = 13)
  buf.set([0, 0, 0, 13], 8);
  // IHDR chunk type
  buf.set([73, 72, 68, 82], 12);
  // Width (bytes 16-19, big-endian)
  const dv = new DataView(buf.buffer);
  dv.setUint32(16, width, false);
  dv.setUint32(20, height, false);
  return buf;
};

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-assets-test-'));

const writeIcon = (root: string, relPath: string, size = 1024): void => {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, buildMinimalPng(size, size));
};

interface SpawnCall {
  argv: string[];
}

interface SpawnStub {
  stub: (argv: string[]) => { exited: Promise<number>; stderr: ReadableStream };
  calls: SpawnCall[];
}

const makeSpawnStub = (exitCode = 0): SpawnStub => {
  const calls: SpawnCall[] = [];
  const stub = (
    argv: string[],
  ): { exited: Promise<number>; stderr: ReadableStream } => {
    calls.push({ argv });
    return { exited: Promise.resolve(exitCode), stderr: new ReadableStream() };
  };
  return { stub, calls };
};

// ─── ICON_SLOTS ───────────────────────────────────────────────────────────────

describe('ICON_SLOTS', () => {
  it('has exactly 8 slots', () => {
    expect(ICON_SLOTS).toHaveLength(8);
  });

  it('covers all DetectedAssets keys', () => {
    const keys = ICON_SLOTS.map((s) => s.key);
    expect(keys).toContain('icon');
    expect(keys).toContain('splash');
    expect(keys).toContain('background');
    expect(keys).toContain('monochrome');
    expect(keys).toContain('iconDark');
    expect(keys).toContain('splashDark');
    expect(keys).toContain('backgroundDark');
    expect(keys).toContain('monochromeDark');
  });

  it('maps dark slots to icons/dark/ subdirectory', () => {
    const darkSlots = ICON_SLOTS.filter((s) => s.key.endsWith('Dark'));
    for (const slot of darkSlots) {
      expect(slot.relPath).toContain('icons/dark/');
    }
  });
});

// ─── readPngDimensions ────────────────────────────────────────────────────────

describe('readPngDimensions', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('reads width and height from bytes 16-23 (big-endian)', () => {
    const pngPath = join(tmp, 'test.png');
    writeFileSync(pngPath, buildMinimalPng(1024, 1024));
    const dims = readPngDimensions(pngPath);
    expect(dims.width).toBe(1024);
    expect(dims.height).toBe(1024);
  });

  it('reads non-square dimensions correctly', () => {
    const pngPath = join(tmp, 'test.png');
    writeFileSync(pngPath, buildMinimalPng(512, 256));
    const dims = readPngDimensions(pngPath);
    expect(dims.width).toBe(512);
    expect(dims.height).toBe(256);
  });
});

// ─── hashFile ────────────────────────────────────────────────────────────────

describe('hashFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns a deterministic hex string', async () => {
    const p = join(tmp, 'a.png');
    writeFileSync(p, 'hello');
    const h1 = await hashFile(p);
    const h2 = await hashFile(p);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]+$/);
  });

  it('returns different hashes for different content', async () => {
    const p1 = join(tmp, 'a.png');
    const p2 = join(tmp, 'b.png');
    writeFileSync(p1, 'hello');
    writeFileSync(p2, 'world');
    const h1 = await hashFile(p1);
    const h2 = await hashFile(p2);
    expect(h1).not.toBe(h2);
  });
});

// ─── detectAssets ─────────────────────────────────────────────────────────────

describe('detectAssets', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns {} when icons/ directory is missing', () => {
    expect(detectAssets(tmp)).toEqual({});
  });

  it('returns {} when icons/ directory is empty', () => {
    mkdirSync(join(tmp, 'icons'));
    expect(detectAssets(tmp)).toEqual({});
  });

  it('detects icon.png only', () => {
    writeIcon(tmp, 'icons/icon.png');
    expect(detectAssets(tmp)).toEqual({ icon: true });
  });

  it('detects splash.png only', () => {
    writeIcon(tmp, 'icons/splash.png');
    expect(detectAssets(tmp)).toEqual({ splash: true });
  });

  it('detects background.png only', () => {
    writeIcon(tmp, 'icons/background.png');
    expect(detectAssets(tmp)).toEqual({ background: true });
  });

  it('detects monochrome.png only', () => {
    writeIcon(tmp, 'icons/monochrome.png');
    expect(detectAssets(tmp)).toEqual({ monochrome: true });
  });

  it('detects dark/icon.png only', () => {
    writeIcon(tmp, 'icons/dark/icon.png');
    expect(detectAssets(tmp)).toEqual({ iconDark: true });
  });

  it('detects dark/background.png only', () => {
    writeIcon(tmp, 'icons/dark/background.png');
    expect(detectAssets(tmp)).toEqual({ backgroundDark: true });
  });

  it('detects icon.png + dark/background.png', () => {
    writeIcon(tmp, 'icons/icon.png');
    writeIcon(tmp, 'icons/dark/background.png');
    expect(detectAssets(tmp)).toEqual({ icon: true, backgroundDark: true });
  });

  it('detects all 8 slots when every file is present', () => {
    writeIcon(tmp, 'icons/icon.png');
    writeIcon(tmp, 'icons/splash.png');
    writeIcon(tmp, 'icons/background.png');
    writeIcon(tmp, 'icons/monochrome.png');
    writeIcon(tmp, 'icons/dark/icon.png');
    writeIcon(tmp, 'icons/dark/splash.png');
    writeIcon(tmp, 'icons/dark/background.png');
    writeIcon(tmp, 'icons/dark/monochrome.png');
    expect(detectAssets(tmp)).toEqual({
      icon: true,
      splash: true,
      background: true,
      monochrome: true,
      iconDark: true,
      splashDark: true,
      backgroundDark: true,
      monochromeDark: true,
    });
  });
});

// ─── generateAssets — spawn matrix ───────────────────────────────────────────

describe('generateAssets — spawn matrix', () => {
  let projectRoot: string;
  let flutterDir: string;

  beforeEach(() => {
    projectRoot = makeTmp();
    flutterDir = makeTmp();
    mkdirSync(join(flutterDir, '.fsx-assets'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(flutterDir, { recursive: true, force: true });
  });

  it('spawns 0 times when icons/ is empty', async () => {
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls).toHaveLength(0);
  });

  it('spawns both engines when only icon.png is present', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    const cmds = calls.map((c) => c.argv.join(' '));
    expect(cmds.some((c) => c.includes('flutter_launcher_icons'))).toBe(true);
    expect(cmds.some((c) => c.includes('flutter_native_splash'))).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('spawns only splash engine when only splash.png is present (no icon.png)', async () => {
    writeIcon(projectRoot, 'icons/splash.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    const cmds = calls.map((c) => c.argv.join(' '));
    expect(cmds.some((c) => c.includes('flutter_native_splash'))).toBe(true);
    expect(cmds.some((c) => c.includes('flutter_launcher_icons'))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('spawns both engines when icon.png + splash.png are present', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/splash.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls).toHaveLength(2);
  });

  it('spawns both engines when icon.png + background.png are present', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/background.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls).toHaveLength(2);
  });

  it('spawns both engines when icon.png + monochrome.png are present', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/monochrome.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls).toHaveLength(2);
  });

  it('spawns both engines when all 8 files are present', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/splash.png');
    writeIcon(projectRoot, 'icons/background.png');
    writeIcon(projectRoot, 'icons/monochrome.png');
    writeIcon(projectRoot, 'icons/dark/icon.png');
    writeIcon(projectRoot, 'icons/dark/splash.png');
    writeIcon(projectRoot, 'icons/dark/background.png');
    writeIcon(projectRoot, 'icons/dark/monochrome.png');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls).toHaveLength(2);
  });
});

// ─── generateAssets — hash cache ─────────────────────────────────────────────

describe('generateAssets — hash cache', () => {
  let projectRoot: string;
  let flutterDir: string;

  beforeEach(() => {
    projectRoot = makeTmp();
    flutterDir = makeTmp();
    mkdirSync(join(flutterDir, '.fsx-assets'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(flutterDir, { recursive: true, force: true });
  });

  it('spawns 0 times on second call when files are unchanged', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    const { stub: stub1 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub1,
    });

    const { stub: stub2, calls: calls2 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub2,
    });
    expect(calls2).toHaveLength(0);
  });

  it('re-spawns both engines when background.png is mutated', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/background.png');
    const { stub: stub1 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub1,
    });

    // Mutate background.png
    writeIcon(projectRoot, 'icons/background.png', 512);
    const { stub: stub2, calls: calls2 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub2,
    });
    const cmds = calls2.map((c) => c.argv.join(' '));
    expect(cmds.some((c) => c.includes('flutter_launcher_icons'))).toBe(true);
    expect(cmds.some((c) => c.includes('flutter_native_splash'))).toBe(true);
  });

  it('re-spawns only splash engine when splash.png is mutated', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/splash.png');
    const { stub: stub1 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub1,
    });

    // Mutate only splash.png
    writeFileSync(
      join(projectRoot, 'icons/splash.png'),
      buildMinimalPng(512, 512),
    );
    const { stub: stub2, calls: calls2 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub2,
    });
    const cmds = calls2.map((c) => c.argv.join(' '));
    expect(cmds.some((c) => c.includes('flutter_native_splash'))).toBe(true);
    expect(cmds.some((c) => c.includes('flutter_launcher_icons'))).toBe(false);
  });

  it('re-spawns only launcher engine when monochrome.png is mutated', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    writeIcon(projectRoot, 'icons/monochrome.png');
    const { stub: stub1 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub1,
    });

    // Mutate only monochrome.png (launcher-only dep)
    writeFileSync(
      join(projectRoot, 'icons/monochrome.png'),
      buildMinimalPng(512, 512),
    );
    const { stub: stub2, calls: calls2 } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub2,
    });
    const cmds = calls2.map((c) => c.argv.join(' '));
    expect(cmds.some((c) => c.includes('flutter_launcher_icons'))).toBe(true);
    expect(cmds.some((c) => c.includes('flutter_native_splash'))).toBe(false);
  });
});

// ─── generateAssets — warnings & errors ──────────────────────────────────────

describe('generateAssets — warnings and errors', () => {
  let projectRoot: string;
  let flutterDir: string;

  beforeEach(() => {
    projectRoot = makeTmp();
    flutterDir = makeTmp();
    mkdirSync(join(flutterDir, '.fsx-assets'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(flutterDir, { recursive: true, force: true });
  });

  it('emits exactly one logger.warn when icon.png is not 1024x1024, and still spawns', async () => {
    writeIcon(projectRoot, 'icons/icon.png', 512);
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(calls.length).toBeGreaterThan(0);
    warnSpy.mockRestore();
  });

  it('calls logger.error on non-zero spawn exit, but resolves without throwing', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const { stub } = makeSpawnStub(1); // exit code 1
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handles malformed JSON in hash cache gracefully (treats as empty cache)', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    const hashCachePath = join(flutterDir, '.fsx-asset-hashes.json');
    writeFileSync(hashCachePath, '{ invalid json }', 'utf-8');
    const { stub, calls } = makeSpawnStub();
    await generateAssets({
      projectRoot,
      flutterDir,
      dartBin: 'dart',
      spawn: stub,
    });
    expect(calls.length).toBeGreaterThan(0);
  });

  it('uses defaultSpawn (no injection) with a real no-op dartBin', async () => {
    writeIcon(projectRoot, 'icons/icon.png');
    const dartScript = join(flutterDir, 'dart-noop');
    writeFileSync(dartScript, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    await generateAssets({ projectRoot, flutterDir, dartBin: dartScript });
    const hashCachePath = join(flutterDir, '.fsx-asset-hashes.json');
    expect(existsSync(hashCachePath)).toBe(true);
  });
});
