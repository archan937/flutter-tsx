import { defu } from 'defu';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';

import type { AppConfig } from '../../../types/app-toml.js';

const DEFAULTS: AppConfig = {
  name: 'my-flutter-app',
  bundleId: 'com.example.myapp',
  flutterVersion: '>=3.0.0',
  target: 'web',
  dependencies: {},
  watch: ['src/**/*.tsx'],
  outDir: '.fsx/flutter/lib',
};

export const readConfig = (root: string): AppConfig => {
  const configPath = join(root, 'app.toml');

  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
  }

  const raw = readFileSync(configPath, 'utf-8');
  const parsed = parseToml(raw) as Partial<AppConfig>;

  return defu(parsed, DEFAULTS) as AppConfig;
};
