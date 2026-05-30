import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadSurfaceConfig } from '@src/flutter/surface.js';

const mkProject = (name: string, content: string | null): string => {
  const root = mkdtempSync(join(tmpdir(), 'fsx-surface-'));
  if (content !== null) {
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'config', `${name}.ts`), content, 'utf-8');
  }
  return root;
};

describe('loadSurfaceConfig', () => {
  it('returns null when config/<name>.ts is absent', async () => {
    const root = mkProject('env', null);
    expect(await loadSurfaceConfig(root, 'env')).toBeNull();
  });

  it('imports the default export of config/<name>.ts', async () => {
    const root = mkProject(
      'env',
      `export default { API_URL: 'https://api.example.com', FLAG: 'on' };`,
    );
    const env = await loadSurfaceConfig<Record<string, string>>(root, 'env');
    expect(env).toEqual({ API_URL: 'https://api.example.com', FLAG: 'on' });
  });

  it('returns null when the module has no default export', async () => {
    const root = mkProject('theme', `export const notDefault = 1;`);
    expect(await loadSurfaceConfig(root, 'theme')).toBeNull();
  });
});
