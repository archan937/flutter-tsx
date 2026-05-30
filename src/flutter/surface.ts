import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Imports a typed surface config module — `config/<name>.ts` (e.g. `env`,
 * `theme`, `links`) — and returns its default export, or `null` if the file
 * is absent or has no default export. fsx runs on Bun, so the developer's
 * TypeScript config is imported directly (no parser, no second config format).
 */
export const loadSurfaceConfig = async <T>(
  root: string,
  name: string,
): Promise<T | null> => {
  const configPath = join(root, 'config', `${name}.ts`);
  if (!existsSync(configPath)) return null;

  const mod = (await import(configPath)) as { default?: T };
  return mod.default ?? null;
};
