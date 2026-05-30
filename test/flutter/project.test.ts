import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { AppConfig } from '@src/config.js';
import {
  ensureFlutterProject,
  flutterCreateArgs,
  SUPPORTED_PLATFORMS,
} from '@src/flutter/project.js';

const baseConfig: AppConfig = { name: 'test_app' };

describe('flutterCreateArgs', () => {
  it('scaffolds all six platform folders via --platforms', () => {
    const args = flutterCreateArgs('flutter', 'demo_app', '/tmp/proj');
    const i = args.indexOf('--platforms');
    expect(i).toBeGreaterThan(-1);
    const list = args[i + 1].split(',');
    expect([...list].sort()).toEqual([
      'android',
      'ios',
      'linux',
      'macos',
      'web',
      'windows',
    ]);
  });

  it('passes project name, --no-pub, and the target dir', () => {
    const args = flutterCreateArgs('/opt/flutter', 'demo_app', '/tmp/proj');
    expect(args[0]).toBe('/opt/flutter');
    expect(args[1]).toBe('create');
    expect(args).toContain('--project-name');
    expect(args[args.indexOf('--project-name') + 1]).toBe('demo_app');
    expect(args).toContain('--no-pub');
    expect(args[args.length - 1]).toBe('/tmp/proj');
  });

  it('SUPPORTED_PLATFORMS lists the six Flutter targets', () => {
    expect([...SUPPORTED_PLATFORMS].sort()).toEqual([
      'android',
      'ios',
      'linux',
      'macos',
      'web',
      'windows',
    ]);
  });
});

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-project-test-'));

const buildMinimalPng = (width = 1024, height = 1024): Uint8Array => {
  const buf = new Uint8Array(24);
  buf.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  buf.set([0, 0, 0, 13], 8);
  buf.set([73, 72, 68, 82], 12);
  const dv = new DataView(buf.buffer);
  dv.setUint32(16, width, false);
  dv.setUint32(20, height, false);
  return buf;
};

const mockFlutter = (): string => {
  // Create a fake `flutter` script that exits 0 for any args
  const scriptPath = join(makeTmp(), 'flutter');
  writeFileSync(scriptPath, '#!/bin/sh\nmkdir -p "$4" 2>/dev/null; exit 0\n', {
    mode: 0o755,
  });
  return scriptPath;
};

const mockDart = (): string => {
  const scriptPath = join(makeTmp(), 'dart');
  writeFileSync(scriptPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return scriptPath;
};

describe('ensureFlutterProject — brand assets integration', () => {
  it('omits launcher/splash blocks when icons/ is absent', async () => {
    const projectRoot = makeTmp();
    const flutterDir = makeTmp();
    const flutterBin = mockFlutter();
    const dartBin = mockDart();

    try {
      await ensureFlutterProject(flutterDir, baseConfig, {
        flutterBin,
        projectRoot,
        dartBin,
      });

      const pubspecPath = join(flutterDir, 'pubspec.yaml');
      const pubspec = await Bun.file(pubspecPath).text();
      expect(pubspec).not.toContain('flutter_launcher_icons');
      expect(pubspec).not.toContain('flutter_native_splash');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(flutterDir, { recursive: true, force: true });
    }
  });

  it('includes launcher/splash blocks when icons/icon.png is present', async () => {
    const projectRoot = makeTmp();
    const flutterDir = makeTmp();
    const flutterBin = mockFlutter();
    const dartBin = mockDart();

    try {
      mkdirSync(join(projectRoot, 'icons'), { recursive: true });
      writeFileSync(join(projectRoot, 'icons', 'icon.png'), buildMinimalPng());

      await ensureFlutterProject(flutterDir, baseConfig, {
        flutterBin,
        projectRoot,
        dartBin,
      });

      const pubspecPath = join(flutterDir, 'pubspec.yaml');
      const pubspec = await Bun.file(pubspecPath).text();
      expect(pubspec).toContain('flutter_launcher_icons: ^0.14.1');
      expect(pubspec).toContain('flutter_native_splash: ^2.4.3');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(flutterDir, { recursive: true, force: true });
    }
  });

  it('copies fonts into .fsx-fonts and emits fonts block in pubspec', async () => {
    const projectRoot = makeTmp();
    const flutterDir = makeTmp();
    const flutterBin = mockFlutter();
    const dartBin = mockDart();

    try {
      mkdirSync(join(projectRoot, 'fonts'), { recursive: true });
      writeFileSync(
        join(projectRoot, 'fonts', 'Inter-Regular.ttf'),
        'fake-ttf-bytes',
      );

      await ensureFlutterProject(flutterDir, baseConfig, {
        flutterBin,
        projectRoot,
        dartBin,
      });

      const pubspec = await Bun.file(join(flutterDir, 'pubspec.yaml')).text();
      expect(pubspec).toContain('- family: Inter');
      expect(pubspec).toContain('.fsx-fonts/Inter-Regular.ttf');
      expect(
        existsSync(join(flutterDir, '.fsx-fonts', 'Inter-Regular.ttf')),
      ).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(flutterDir, { recursive: true, force: true });
    }
  });

  it('backward compat: omitting projectRoot skips asset detection', async () => {
    const flutterDir = makeTmp();
    const flutterBin = mockFlutter();

    try {
      await ensureFlutterProject(flutterDir, baseConfig, { flutterBin });
      const pubspecPath = join(flutterDir, 'pubspec.yaml');
      const pubspec = await Bun.file(pubspecPath).text();
      expect(pubspec).not.toContain('flutter_launcher_icons');
    } finally {
      rmSync(flutterDir, { recursive: true, force: true });
    }
  });
});
