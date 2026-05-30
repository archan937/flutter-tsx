import { defineCommand } from 'citty';
import { resolve } from 'path';

import { buildBuildArgs } from '../../flutter/build.js';
import { logger } from '../utils/logger.js';
import { prepareProject } from './prepare.js';

export const buildCmd = defineCommand({
  meta: {
    name: 'build',
    description:
      'Transpile TSX to Dart and build a release artifact for a target',
  },
  args: {
    target: {
      type: 'string',
      description:
        'Build target (web, ios, android, macos, windows, linux). Defaults to config/app.ts target.',
    },
    root: {
      type: 'string',
      description: 'Project root directory',
      default: process.cwd(),
    },
  },
  async run({ args }) {
    const root = resolve(args.root ?? process.cwd());
    const { flutterBin, flutterDir, target, dartDefines } =
      await prepareProject(root, args.target as string | undefined);

    if (!target) {
      logger.error(
        'No build target. Set `target` in config/app.ts or pass --target.',
      );
      process.exit(1);
    }

    logger.info(`Building ${target}...`);
    const proc = Bun.spawn(buildBuildArgs(flutterBin, target, dartDefines), {
      cwd: flutterDir,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const code = (await proc.exited) ?? 0;
    if (code !== 0) {
      logger.error(`flutter build ${target} failed (exit ${code}).`);
      process.exit(code);
    }
    logger.success(`Built ${target}.`);
  },
});
