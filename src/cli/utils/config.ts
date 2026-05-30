import { existsSync } from 'fs';
import { join } from 'path';

import type { AppConfig } from '../../config.js';

const DEFAULTS: AppConfig = {
  name: 'my-flutter-app',
  bundleId: 'com.example.myapp',
  flutterVersion: '>=3.0.0',
  target: 'web',
  dependencies: {},
  watch: ['src/**/*.tsx'],
  outDir: '.fsx/flutter/lib',
};

/**
 * Loads `config/app.ts` (a typed module exporting `defineConfig({...})`) from
 * the project root and merges it over the defaults. fsx runs on Bun, so the
 * TypeScript config is imported directly — no parser, no second config format.
 */
export const readConfig = async (root: string): Promise<AppConfig> => {
  const configPath = join(root, 'config', 'app.ts');

  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
  }

  const mod = (await import(configPath)) as {
    default?: Partial<AppConfig>;
    config?: Partial<AppConfig>;
  };
  const userConfig = mod.default ?? mod.config ?? {};

  // Shallow, user-wins merge: a value the developer sets replaces the default
  // outright (arrays are not concatenated). The config is intentionally flat.
  return { ...DEFAULTS, ...userConfig };
};
