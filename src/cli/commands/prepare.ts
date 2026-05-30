import { existsSync } from 'fs';
import { join } from 'path';

import type { AppConfig, Links, Theme } from '../../config.js';
import { envToDartDefines } from '../../flutter/env.js';
import { ensureFlutterProject } from '../../flutter/project.js';
import {
  applyLinks,
  applyLocales,
  applyPermissions,
  loadSurfaceConfig,
} from '../../flutter/surface.js';
import { themeToMaterialAppProps } from '../../flutter/theme.js';
import { transpileAll, type TranspileOptions } from '../../transpiler/index.js';
import { readConfig, resolveTarget } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { FLUTTER_BIN } from './install.js';

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
  try {
    const results = await transpileAll(srcDir, outDir, transpileOptions);
    detectedPackages = [...new Set(results.flatMap((r) => r.packages))];
    detectedCapabilities = [...new Set(results.flatMap((r) => r.capabilities))];
    logger.success(`Transpiled ${results.length} file(s)`);
  } catch (err) {
    logger.error('Transpile error:', err);
  }

  if (detectedPackages.length > 0) {
    logger.start('Installing plugin packages...');
    try {
      await ensureFlutterProject(flutterDir, config, {
        flutterBin,
        extraDeps: detectedPackages,
        projectRoot: root,
      });
      logger.success('Plugin packages installed');
    } catch (err) {
      logger.error('Failed to install plugin packages:', err);
    }
  }

  // Permissions: inferred capabilities + optional config/permissions.ts strings.
  const permissionDescriptions =
    (await loadSurfaceConfig<Record<string, string>>(root, 'permissions')) ??
    {};
  applyPermissions(flutterDir, detectedCapabilities, permissionDescriptions);

  // Links + locales surfaces. (Signing/release is build-time only — applied by
  // `fsx build` from config/platforms/<os>.ts, not in this shared dev/build prelude.)
  const links = await loadSurfaceConfig<Links>(root, 'links');
  if (links) applyLinks(flutterDir, links);

  applyLocales(root, outDir);

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
