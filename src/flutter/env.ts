import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

const stripQuotes = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
};

const parseEnvFile = (path: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const content = readFileSync(path, 'utf-8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) {
      logger.warn(`env: malformed line in ${path}: "${line}"`);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const value = stripQuotes(line.slice(eqIdx + 1));
    result[key] = value;
  }

  return result;
};

export const loadEnv = (
  projectRoot: string,
  mode: string,
): Record<string, string> => {
  const base: Record<string, string> = {};

  const basePath = join(projectRoot, '.env');
  if (existsSync(basePath)) {
    Object.assign(base, parseEnvFile(basePath));
  }

  if (mode !== 'development') {
    const overlayPath = join(projectRoot, `.env.${mode}`);
    if (existsSync(overlayPath)) {
      Object.assign(base, parseEnvFile(overlayPath));
    }
  }

  return base;
};

export const envToDartDefines = (env: Record<string, string>): string[] => {
  const keys = Object.keys(env).sort();
  return keys.map((key) => `--dart-define=${key}=${env[key]}`);
};
