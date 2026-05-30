import chokidar from 'chokidar';
import { defineCommand } from 'citty';
import { join, resolve } from 'path';

import { FlutterRunner } from '../../flutter/runner.js';
import { transpileFile } from '../../transpiler/index.js';
import { logger } from '../utils/logger.js';
import { prepareProject } from './prepare.js';

export const devCmd = defineCommand({
  meta: {
    name: 'dev',
    description: 'Watch TSX sources, transpile to Dart, and run Flutter',
  },
  args: {
    target: {
      type: 'string',
      description: 'Flutter target device (web, ios, android, macos, linux)',
    },
    root: {
      type: 'string',
      description: 'Project root directory',
      default: process.cwd(),
    },
  },
  async run({ args }) {
    const root = resolve(args.root ?? process.cwd());

    logger.info(`Starting flutter.tsx dev server`);

    // Shared dev/build prelude: scaffold, transpile, apply config surfaces.
    const {
      flutterBin,
      flutterDir,
      outDir,
      config,
      target,
      dartDefines,
      transpileOptions,
    } = await prepareProject(root, args.target as string | undefined);

    logger.info(`Target: ${target}`);

    // Start flutter runner (interactive `flutter run` with hot reload).
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
