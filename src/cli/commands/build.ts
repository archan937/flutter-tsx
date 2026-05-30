import { defineCommand } from 'citty';
import { resolve } from 'path';

import type {
  AndroidConfig,
  IosConfig,
  MacosConfig,
  WindowsConfig,
} from '../../config.js';
import { buildBuildArgs } from '../../flutter/build.js';
import {
  prepareAndroidSigning,
  prepareIosSigning,
} from '../../flutter/signing.js';
import {
  signMacosApp,
  signWindowsArtifact,
} from '../../flutter/signing-run.js';
import { loadPlatformConfig } from '../../flutter/surface.js';
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

    // Pre-build signing prep (config/platforms/<os>.ts → native project).
    if (target === 'android') {
      const cfg = await loadPlatformConfig<AndroidConfig>(root, 'android');
      if (cfg) prepareAndroidSigning(root, flutterDir, cfg);
    } else if (target === 'ios') {
      const cfg = await loadPlatformConfig<IosConfig>(root, 'ios');
      if (cfg) prepareIosSigning(root, flutterDir, cfg);
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

    // Post-build signing (desktop): codesign+notarize / Authenticode.
    if (target === 'macos') {
      const cfg = await loadPlatformConfig<MacosConfig>(root, 'macos');
      if (cfg?.signing) await signMacosApp(flutterDir, cfg.signing);
    } else if (target === 'windows') {
      const cfg = await loadPlatformConfig<WindowsConfig>(root, 'windows');
      if (cfg?.signing)
        await signWindowsArtifact(root, flutterDir, cfg.signing);
    }

    logger.success(`Built ${target}.`);
  },
});
