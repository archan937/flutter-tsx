import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { readConfig } from '@src/cli/utils/config.js';
import { defineConfig } from '@src/config.js';

const mkProject = (appTs: string | null): string => {
  const root = mkdtempSync(join(tmpdir(), 'fsx-config-'));
  if (appTs !== null) {
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'config', 'app.ts'), appTs, 'utf-8');
  }
  return root;
};

describe('defineConfig', () => {
  it('returns the config object unchanged (identity helper)', () => {
    const cfg = {
      name: 'demo',
      bundleId: 'com.x.demo',
      target: 'ios' as const,
    };
    expect(defineConfig(cfg)).toBe(cfg);
  });
});

describe('readConfig', () => {
  it('returns defaults when config/app.ts is absent', async () => {
    const root = mkProject(null);
    const cfg = await readConfig(root);
    expect(cfg.name).toBe('my-flutter-app');
    expect(cfg.target).toBe('web');
    expect(cfg.outDir).toBe('.fsx/flutter/lib');
    expect(cfg.watch).toEqual(['src/**/*.tsx']);
  });

  it('merges a default-export config over the defaults', async () => {
    const root = mkProject(
      `export default { name: 'my-app', bundleId: 'com.example.myapp', target: 'ios' };`,
    );
    const cfg = await readConfig(root);
    expect(cfg.name).toBe('my-app');
    expect(cfg.bundleId).toBe('com.example.myapp');
    expect(cfg.target).toBe('ios');
    // unspecified fields fall back to defaults
    expect(cfg.outDir).toBe('.fsx/flutter/lib');
    expect(cfg.flutterVersion).toBe('>=3.0.0');
  });

  it('supports a named `config` export', async () => {
    const root = mkProject(
      `export const config = { name: 'named-app', target: 'macos' };`,
    );
    const cfg = await readConfig(root);
    expect(cfg.name).toBe('named-app');
    expect(cfg.target).toBe('macos');
  });

  it('user values win over defaults; arrays are not deep-merged into junk', async () => {
    const root = mkProject(
      `export default { name: 'w', watch: ['lib/**/*.tsx'] };`,
    );
    const cfg = await readConfig(root);
    expect(cfg.watch).toEqual(['lib/**/*.tsx']);
  });
});
