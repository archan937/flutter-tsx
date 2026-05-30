import chokidar from 'chokidar';
import { defineCommand } from 'citty';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

import type { Links, ReleaseConfig, Theme } from '../../config.js';
import { envToDartDefines } from '../../flutter/env.js';
import { ensureFlutterProject } from '../../flutter/project.js';
import { FlutterRunner } from '../../flutter/runner.js';
import {
  applyLinks,
  applyLocales,
  applyPermissions,
  applyRelease,
  loadSurfaceConfig,
} from '../../flutter/surface.js';
import { themeToMaterialAppProps } from '../../flutter/theme.js';
import { transpileAll, transpileFile } from '../../transpiler/index.js';
import { readConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { FLUTTER_BIN } from './install.js';

export const devCmd = defineCommand({
  meta: {
    name: 'dev',
    description: 'Watch TSX sources, transpile to Dart, and run Flutter',
  },
  args: {
    target: {
      type: 'string',
      description: 'Flutter target device (web, ios, android, macos, linux)',
      default: '',
    },
    root: {
      type: 'string',
      description: 'Project root directory',
      default: process.cwd(),
    },
  },
  async run({ args }) {
    // 0. Check Flutter is available
    const flutterBin =
      Bun.which('flutter') ?? (existsSync(FLUTTER_BIN) ? FLUTTER_BIN : null);
    if (!flutterBin) {
      logger.error('Flutter SDK not found in PATH.');
      logger.info('Run `fsx install` to install Flutter automatically.');
      process.exit(1);
    }

    const root = resolve(args.root ?? process.cwd());
    const config = await readConfig(root);
    const target = (args.target as string | undefined) ?? config.target;

    const flutterDir = join(root, '.fsx', 'flutter');
    const srcDir = join(root, 'src');
    const outDir = join(root, config.outDir ?? '.fsx/flutter/lib');

    // Surface: config/theme.ts → MaterialApp theme/darkTheme injected at codegen.
    const theme = await loadSurfaceConfig<Theme>(root, 'theme');
    const transpileOptions = theme
      ? { materialAppProps: themeToMaterialAppProps(theme) }
      : {};

    logger.info(`Starting flutter.tsx dev server`);
    logger.info(`Target: ${target}`);

    // 1. Ensure flutter project (initial scaffold with config.dependencies only)
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

    // 2. Initial transpile — collect detected plugin packages
    logger.start('Transpiling TSX → Dart...');
    let detectedPackages: string[] = [];
    let detectedCapabilities: string[] = [];
    try {
      const results = await transpileAll(srcDir, outDir, transpileOptions);
      detectedPackages = [...new Set(results.flatMap((r) => r.packages))];
      detectedCapabilities = [
        ...new Set(results.flatMap((r) => r.capabilities)),
      ];
      logger.success(`Transpiled ${results.length} file(s)`);
    } catch (err) {
      logger.error('Transpile error:', err);
    }

    // 2b. If new packages detected, re-write pubspec and run pub get
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

    // 2c. Apply permissions surface: inferred capabilities + optional
    // config/permissions.ts descriptions → Info.plist / AndroidManifest.
    const permissionDescriptions =
      (await loadSurfaceConfig<Record<string, string>>(root, 'permissions')) ??
      {};
    applyPermissions(flutterDir, detectedCapabilities, permissionDescriptions);

    // 2d. Apply links surface: config/links.ts → Info.plist / entitlements /
    // AndroidManifest (custom scheme + universal/app link domains).
    const links = await loadSurfaceConfig<Links>(root, 'links');
    if (links) applyLinks(flutterDir, links);

    // 2e. Locales surface: locales/*.json → generated <outDir>/l10n.dart (global `t`).
    applyLocales(root, outDir);

    // 2f. Release surface: config/release.ts → key.properties + push config files.
    const release = await loadSurfaceConfig<ReleaseConfig>(root, 'release');
    if (release) applyRelease(root, flutterDir, release);

    // 3. Start flutter runner — surface env (config/env.ts) → --dart-define flags
    const envConfig =
      (await loadSurfaceConfig<Record<string, string>>(root, 'env')) ?? {};
    const dartDefines = envToDartDefines(envConfig);
    const runner = new FlutterRunner(flutterDir, {
      target,
      flutterBin,
      dartDefines,
    });
    try {
      await runner.start();
    } catch (err) {
      logger.error('Failed to start Flutter:', err);
      process.exit(1);
    }

    // 4. Watch for changes
    const watchPatterns = (config.watch ?? ['src/**/*.tsx']).map((p) =>
      join(root, p),
    );

    const watcher = chokidar.watch(watchPatterns, {
      ignoreInitial: true,
      persistent: true,
    });

    watcher.on('change', async (filePath: string) => {
      logger.info(`Changed: ${filePath.replace(root + '/', '')}`);
      try {
        await transpileFile(filePath, outDir, transpileOptions);
        await runner.hotReload();
        logger.success('Hot reload sent');
      } catch (err) {
        logger.error('Transpile/reload error:', err);
      }
    });

    watcher.on('add', async (filePath: string) => {
      logger.info(`Added: ${filePath.replace(root + '/', '')}`);
      try {
        await transpileFile(filePath, outDir, transpileOptions);
        await runner.hotRestart();
      } catch (err) {
        logger.error('Transpile error:', err);
      }
    });

    // 5. Graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('\nShutting down...');
      await watcher.close();
      await runner.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.success(
      `Watching ${watchPatterns.length} pattern(s). Press Ctrl+C to stop.`,
    );
  },
});
