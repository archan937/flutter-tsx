import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { AppConfig, TrayConfig } from '../config.js';
import {
  mainDart,
  type StoreProvider,
  trayMainDart,
} from '../templates/main-dart.js';
import { pubspecYaml } from '../templates/pubspec-yaml.js';
import { widgetTestDart } from '../templates/widget-test-dart.js';
import { detectAssets, generateAssets, hashFile } from './assets.js';
import { detectFonts, type FontMap } from './fonts.js';

/** Flutter package name derived from the app name (lower_snake, pubspec-safe). */
const toPackageName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

/**
 * The source image for the menubar tray icon: a dedicated monochrome glyph at
 * `icons/tray.png` when present, else the colourful app icon `icons/icon.png`.
 * Returns null when neither exists.
 */
export const resolveTrayIconSource = (projectRoot: string): string | null => {
  const tray = join(projectRoot, 'icons', 'tray.png');
  if (existsSync(tray)) return tray;
  const icon = join(projectRoot, 'icons', 'icon.png');
  return existsSync(icon) ? icon : null;
};

export interface EnsureFlutterProjectOptions {
  flutterBin?: string;
  extraDeps?: string[];
  projectRoot?: string;
  dartBin?: string;
  /** Stores to wire as `ChangeNotifierProvider`s at the app root (main.dart). */
  stores?: StoreProvider[];
  /** `config/tray.ts` — turns the app into a system-tray / menubar app. */
  tray?: TrayConfig;
}

/**
 * The Flutter targets fsx scaffolds. Passed to `flutter create --platforms` so
 * every platform folder (ios/android/web/macos/windows/linux) always exists —
 * otherwise `flutter build <desktop>` fails when the SDK hasn't locally enabled
 * that desktop platform.
 */
export const SUPPORTED_PLATFORMS = [
  'web',
  'ios',
  'android',
  'macos',
  'windows',
  'linux',
] as const;

/** Assembles the `flutter create` argv (pure — exposed for testing). */
export const flutterCreateArgs = (
  flutterBin: string,
  appName: string,
  flutterDir: string,
): string[] => [
  flutterBin,
  'create',
  '--project-name',
  appName,
  '--platforms',
  SUPPORTED_PLATFORMS.join(','),
  '--no-pub',
  flutterDir,
];

export const ensureFlutterProject = async (
  flutterDir: string,
  config: AppConfig,
  {
    flutterBin = 'flutter',
    extraDeps = [],
    projectRoot,
    dartBin,
    stores = [],
    tray,
  }: EnsureFlutterProjectOptions = {},
): Promise<void> => {
  const libDir = join(flutterDir, 'lib');
  const testDir = join(flutterDir, 'test');
  const pubspecPath = join(flutterDir, 'pubspec.yaml');
  const mainDartPath = join(libDir, 'main.dart');
  const appName = toPackageName(config.name);

  const needsInit = !existsSync(pubspecPath);

  if (needsInit) {
    const proc = Bun.spawn(flutterCreateArgs(flutterBin, appName, flutterDir), {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    if (proc.exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`flutter create failed: ${err}`);
    }
  }

  const assets = projectRoot ? detectAssets(projectRoot) : {};
  const fonts: FontMap = projectRoot ? detectFonts(projectRoot) : {};

  if (projectRoot && Object.keys(fonts).length > 0) {
    await syncFonts(projectRoot, flutterDir, fonts);
  }

  // System-tray / menubar mode (config/tray.ts): tray_manager + window_manager
  // deps, a bundled tray icon, and the tray main.dart bootstrap in place of the
  // plain runApp entry point. The menubar wants a small monochrome glyph, so the
  // source is `icons/tray.png` when present, falling back to `icons/icon.png`.
  const trayDeps = tray
    ? ['tray_manager: ^0.2.3', 'window_manager: ^0.4.3']
    : [];
  const pubspecConfig = tray
    ? { ...config, assets: [...(config.assets ?? []), 'assets/tray_icon.png'] }
    : config;
  if (tray && projectRoot) {
    const iconSrc = resolveTrayIconSource(projectRoot);
    if (iconSrc) {
      const dest = join(flutterDir, 'assets', 'tray_icon.png');
      mkdirSync(join(flutterDir, 'assets'), { recursive: true });
      writeFileSync(dest, readFileSync(iconSrc));
    }
  }

  // A tray/menubar app must NOT quit when its window is hidden or closed — but
  // `flutter create`'s macOS AppDelegate returns true from
  // applicationShouldTerminateAfterLastWindowClosed, so hiding the window kills
  // the app. Flip it to false so the app lives on in the tray.
  if (tray) {
    const appDelegate = join(
      flutterDir,
      'macos',
      'Runner',
      'AppDelegate.swift',
    );
    if (existsSync(appDelegate)) {
      const src = readFileSync(appDelegate, 'utf-8');
      const patched = src.replace(
        /(applicationShouldTerminateAfterLastWindowClosed\([^)]*\)\s*->\s*Bool\s*\{\s*return\s+)true/,
        '$1false',
      );
      if (patched !== src) writeFileSync(appDelegate, patched, 'utf-8');
    }
  }

  mkdirSync(libDir, { recursive: true });
  writeFileSync(
    pubspecPath,
    pubspecYaml(pubspecConfig, [...extraDeps, ...trayDeps], { assets, fonts }),
    'utf-8',
  );
  writeFileSync(
    mainDartPath,
    tray ? trayMainDart('MainApp', stores, tray) : mainDart('MainApp', stores),
    'utf-8',
  );

  // Replace `flutter create`'s default widget_test.dart (it references `MyApp`,
  // which fsx apps never define → a `flutter analyze` error) with a smoke test
  // that pumps the real root + its store providers.
  mkdirSync(testDir, { recursive: true });
  writeFileSync(
    join(testDir, 'widget_test.dart'),
    widgetTestDart(appName, stores),
    'utf-8',
  );

  const pubGet = Bun.spawn([flutterBin, 'pub', 'get'], {
    cwd: flutterDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await pubGet.exited;

  if (pubGet.exitCode !== 0) {
    const err = await new Response(pubGet.stderr).text();
    console.warn(`flutter pub get warning: ${err}`);
  }

  if (projectRoot) {
    const resolvedDartBin =
      dartBin ?? Bun.which('dart') ?? join(homedir(), '.fsx/flutter/bin/dart');
    try {
      await generateAssets({
        projectRoot,
        flutterDir,
        dartBin: resolvedDartBin,
      });
    } catch (err) {
      console.warn(`[fsx] generateAssets warning: ${err}`);
    }
  }
};

const syncFonts = async (
  projectRoot: string,
  flutterDir: string,
  fonts: FontMap,
): Promise<void> => {
  const destDir = join(flutterDir, '.fsx-fonts');
  mkdirSync(destDir, { recursive: true });

  const hashCachePath = join(flutterDir, '.fsx-font-hashes.json');
  let oldHashes: Record<string, string> = {};
  if (existsSync(hashCachePath)) {
    try {
      oldHashes = JSON.parse(readFileSync(hashCachePath, 'utf-8')) as Record<
        string,
        string
      >;
    } catch {
      oldHashes = {};
    }
  }

  const presentFiles: string[] = [];
  for (const entries of Object.values(fonts)) {
    for (const entry of entries) presentFiles.push(entry.file);
  }

  const newHashes: Record<string, string> = {};
  for (const file of presentFiles) {
    const src = join(projectRoot, 'fonts', file);
    const dest = join(destDir, file);
    const current = await hashFile(src);
    if (current !== oldHashes[file] || !existsSync(dest)) {
      writeFileSync(dest, readFileSync(src));
    }
    newHashes[file] = current;
  }

  writeFileSync(hashCachePath, JSON.stringify(newHashes, null, 2), 'utf-8');
};

export const scaffoldUserProject = async (
  projectDir: string,
  config: {
    name: string;
    bundleId: string;
    target: string;
  },
): Promise<void> => {
  const { appConfig } = await import('../templates/app-config.js');
  const { appTsx } = await import('../templates/app-tsx.js');
  const { userPackageJson } = await import('../templates/user-package-json.js');
  const { userTsconfig } = await import('../templates/user-tsconfig.js');
  const { gitignore } = await import('../templates/gitignore.js');

  const srcDir = join(projectDir, 'src');
  const testDir = join(projectDir, 'tests');
  const configDir = join(projectDir, 'config');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });

  writeFileSync(join(srcDir, 'App.tsx'), appTsx(config.name), 'utf-8');

  writeFileSync(
    join(configDir, 'app.ts'),
    appConfig(config.name, config.bundleId, config.target),
    'utf-8',
  );

  writeFileSync(
    join(projectDir, 'package.json'),
    userPackageJson(config.name),
    'utf-8',
  );

  writeFileSync(join(projectDir, 'tsconfig.json'), userTsconfig(), 'utf-8');

  writeFileSync(join(projectDir, '.gitignore'), gitignore(), 'utf-8');
};
