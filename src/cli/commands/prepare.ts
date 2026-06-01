import { existsSync } from 'fs';
import { join } from 'path';

import type {
  AppConfig,
  Links,
  MacosConfig,
  Theme,
  TrayConfig,
} from '../../config.js';
import { envToDartDefines } from '../../flutter/env.js';
import { formatDartDir } from '../../flutter/format.js';
import { ensureFlutterProject } from '../../flutter/project.js';
import {
  applyLinks,
  applyLocales,
  applyPermissions,
  loadPlatformConfig,
  loadSurfaceConfig,
} from '../../flutter/surface.js';
import { themeToMaterialAppProps } from '../../flutter/theme.js';
import type { StoreProvider } from '../../templates/main-dart.js';
import { transpileAll, type TranspileOptions } from '../../transpiler/index.js';
import { readConfig, resolveTarget } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { FLUTTER_BIN } from './install.js';

/** Collapses duplicate stores (same class declared/imported across files). */
const dedupeStores = (stores: StoreProvider[]): StoreProvider[] => {
  const byClass = new Map<string, StoreProvider>();
  for (const store of stores) byClass.set(store.className, store);
  return [...byClass.values()];
};

export interface PreparedProject {
  flutterBin: string;
  flutterDir: string;
  srcDir: string;
  outDir: string;
  config: AppConfig;
  target: string | undefined;
  dartDefines: string[];
  transpileOptions: TranspileOptions;
}

/** Locates the flutter binary (PATH, then the fsx-managed SDK); exits if absent. */
export const resolveFlutterBin = (): string => {
  const flutterBin =
    Bun.which('flutter') ?? (existsSync(FLUTTER_BIN) ? FLUTTER_BIN : null);
  if (!flutterBin) {
    logger.error('Flutter SDK not found in PATH.');
    logger.info('Run `fsx install` to install Flutter automatically.');
    process.exit(1);
  }
  return flutterBin;
};

/**
 * Shared `dev`/`build` prelude: resolve config + target, scaffold the Flutter
 * project, transpile TSX → Dart (collecting plugin packages + inferred
 * capabilities), install detected packages, then apply every config surface
 * (permissions, links, locales, release) and compute env `--dart-define`s.
 * Idempotent — safe to re-run.
 */
export const prepareProject = async (
  root: string,
  flagTarget: string | undefined,
): Promise<PreparedProject> => {
  const flutterBin = resolveFlutterBin();
  const config = await readConfig(root);
  const target = resolveTarget(flagTarget, config.target);

  const flutterDir = join(root, '.fsx', 'flutter');
  const srcDir = join(root, 'src');
  const outDir = join(root, config.outDir ?? '.fsx/flutter/lib');

  // config/theme.ts → MaterialApp theme/darkTheme injected at codegen.
  const theme = await loadSurfaceConfig<Theme>(root, 'theme');
  const transpileOptions: TranspileOptions = theme
    ? { materialAppProps: themeToMaterialAppProps(theme) }
    : {};

  logger.start('Preparing Flutter project...');
  try {
    await ensureFlutterProject(flutterDir, config, {
      flutterBin,
      projectRoot: root,
    });
    logger.success('Flutter project ready');
  } catch (err) {
    logger.error('Failed to prepare Flutter project:', err);
    process.exit(1);
  }

  logger.start('Transpiling TSX → Dart...');
  let detectedPackages: string[] = [];
  let detectedCapabilities: string[] = [];
  let detectedStores: StoreProvider[] = [];
  try {
    const results = await transpileAll(srcDir, outDir, transpileOptions);
    detectedPackages = [...new Set(results.flatMap((r) => r.packages))];
    detectedCapabilities = [...new Set(results.flatMap((r) => r.capabilities))];
    detectedStores = dedupeStores(results.flatMap((r) => r.stores));
    logger.success(`Transpiled ${results.length} file(s)`);
  } catch (err) {
    logger.error('Transpile error:', err);
  }

  // config/tray.ts → system-tray / menubar app (tray_manager + window_manager
  // bootstrap, tray icon, Show/Hide/Quit menu).
  const tray = await loadSurfaceConfig<TrayConfig>(root, 'tray');

  // Re-sync the project with discovered plugin packages + store providers + tray
  // mode (the initial scaffold ran before transpile, so main.dart/pubspec are
  // rewritten here with the final picture).
  if (detectedPackages.length > 0 || detectedStores.length > 0 || tray) {
    logger.start('Installing plugin packages...');
    try {
      await ensureFlutterProject(flutterDir, config, {
        flutterBin,
        extraDeps: detectedPackages,
        projectRoot: root,
        stores: detectedStores,
        tray: tray ?? undefined,
      });
      logger.success('Plugin packages installed');
    } catch (err) {
      logger.error('Failed to install plugin packages:', err);
    }
  }

  // macOS entitlements require a signing cert to build, so only write them when
  // config/platforms/macos.ts configures signing (else an unsigned `flutter
  // build macos` fails). Info.plist usage strings / URL schemes are unaffected.
  const macosCfg = await loadPlatformConfig<MacosConfig>(root, 'macos');
  const surfaceOpts = { macosEntitlements: Boolean(macosCfg?.signing) };

  // Permissions: inferred capabilities + optional config/permissions.ts strings.
  const permissionDescriptions =
    (await loadSurfaceConfig<Record<string, string>>(root, 'permissions')) ??
    {};
  applyPermissions(flutterDir, detectedCapabilities, {
    descriptions: permissionDescriptions,
    ...surfaceOpts,
  });

  // Links + locales surfaces. (Signing/release is build-time only — applied by
  // `fsx build` from config/platforms/<os>.ts, not in this shared dev/build prelude.)
  const links = await loadSurfaceConfig<Links>(root, 'links');
  if (links) applyLinks(flutterDir, links, surfaceOpts);

  applyLocales(root, outDir);

  // Normalize all generated Dart with `dart format` (the single formatting
  // point — the transpiler emits readable but unformatted Dart). No-op without
  // a dart binary, so it never blocks transpilation.
  if (await formatDartDir(outDir, flutterBin)) {
    logger.success('Formatted generated Dart');
  }

  // config/env.ts → --dart-define flags.
  const envConfig =
    (await loadSurfaceConfig<Record<string, string>>(root, 'env')) ?? {};
  const dartDefines = envToDartDefines(envConfig);

  return {
    flutterBin,
    flutterDir,
    srcDir,
    outDir,
    config,
    target,
    dartDefines,
    transpileOptions,
  };
};
