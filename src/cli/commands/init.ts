import { intro, isCancel, outro, select, spinner, text } from '@clack/prompts';
import { defineCommand } from 'citty';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import { scaffoldUserProject } from '../../flutter/project.js';
import { logger } from '../utils/logger.js';

const TARGET_PLATFORMS = [
  'web',
  'ios',
  'android',
  'macos',
  'windows',
  'linux',
] as const;
type TargetPlatform = (typeof TARGET_PLATFORMS)[number];

const isValidTarget = (v: string): v is TargetPlatform =>
  (TARGET_PLATFORMS as readonly string[]).includes(v);

export const initCmd = defineCommand({
  meta: {
    name: 'init',
    description: 'Scaffold a new flutter.tsx project',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Project name / directory',
      required: false,
    },
    bundleId: {
      type: 'string',
      description:
        'Bundle ID (e.g. com.example.myapp) — skips prompt when provided',
    },
    target: {
      type: 'string',
      description:
        'Target platform: web | ios | android | macos | windows | linux',
    },
  },
  async run({ args }) {
    intro('flutter.tsx — new project');

    const projectName: string = args.name
      ? String(args.name)
      : ((): never => {
          throw new Error('Project name is required');
        })();

    const defaultBundleId = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    // Bundle ID
    let bundleId: string;
    if (args.bundleId) {
      bundleId = String(args.bundleId);
    } else {
      const result = await text({
        message: 'Bundle ID:',
        placeholder: defaultBundleId,
        initialValue: defaultBundleId,
      });
      if (isCancel(result)) process.exit(0);
      bundleId = String(result);
    }

    // Target platform
    let target: TargetPlatform;
    if (args.target) {
      const raw = String(args.target);
      if (!isValidTarget(raw)) {
        logger.error(
          `Invalid target "${raw}". Valid: ${TARGET_PLATFORMS.join(', ')}`,
        );
        process.exit(1);
      }
      target = raw;
    } else {
      const category = await select({
        message: 'What kind of device are you building for?',
        options: [
          { value: 'web', label: 'Web (fastest to start in browser)' },
          { value: 'mobile', label: 'Mobile — iOS / Android' },
          { value: 'desktop', label: 'Desktop — macOS / Windows / Linux' },
        ],
      });
      if (isCancel(category)) process.exit(0);

      if (category === 'mobile') {
        const platform = await select({
          message: 'Mobile target:',
          options: [
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
          ],
        });
        if (isCancel(platform)) process.exit(0);
        target = platform as TargetPlatform;
      } else if (category === 'desktop') {
        const platform = await select({
          message: 'Desktop target:',
          options: [
            { value: 'macos', label: 'macOS' },
            { value: 'windows', label: 'Windows' },
            { value: 'linux', label: 'Linux' },
          ],
        });
        if (isCancel(platform)) process.exit(0);
        target = platform as TargetPlatform;
      } else {
        target = 'web';
      }
    }

    const projectDir = resolve(projectName);

    if (existsSync(projectDir)) {
      logger.warn(
        `Directory ${projectDir} already exists. Files may be overwritten.`,
      );
    }

    const s = spinner();
    s.start(`Scaffolding ${projectName}...`);

    try {
      mkdirSync(projectDir, { recursive: true });
      await scaffoldUserProject(projectDir, {
        name: projectName,
        bundleId,
        target,
      });
      s.stop(`Project created at ${projectDir}`);
    } catch (err) {
      s.stop('Failed to scaffold project');
      logger.error(err);
      process.exit(1);
    }

    outro(
      [
        `Next steps:`,
        `  cd ${projectName}`,
        `  bun install`,
        `  bun run dev`,
      ].join('\n'),
    );
  },
});
