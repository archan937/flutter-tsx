import { describe, expect, it } from 'bun:test';

import type { AppConfig } from '../../types/app-toml.js';
import { pubspecYaml } from './pubspec-yaml.js';

const baseConfig: AppConfig = {
  name: 'my_app',
};

describe('pubspecYaml — extraDeps', () => {
  it('includes extraDeps in the output', () => {
    const out = pubspecYaml(baseConfig, ['camera: ^0.10.6+2']);
    expect(out).toContain('camera: ^0.10.6+2');
  });

  it('merges extraDeps with config.dependencies', () => {
    const config: AppConfig = {
      ...baseConfig,
      dependencies: { provider: '^6.0.0' },
    };
    const out = pubspecYaml(config, ['camera: ^0.10.6+2']);
    expect(out).toContain('provider: ^6.0.0');
    expect(out).toContain('camera: ^0.10.6+2');
  });

  it('de-duplicates extraDeps', () => {
    const out = pubspecYaml(baseConfig, [
      'camera: ^0.10.6+2',
      'camera: ^0.10.6+2',
    ]);
    const count = (out.match(/camera:/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('works with no extraDeps (backward compatible)', () => {
    const out = pubspecYaml(baseConfig);
    expect(out).toContain('name: my_app');
    expect(out).toContain('flutter:');
  });
});

describe('pubspecYaml — assets', () => {
  it('emits flutter assets section when config.assets is non-empty', () => {
    const config: AppConfig = {
      ...baseConfig,
      assets: ['assets/config.json', 'assets/images/'],
    };
    const out = pubspecYaml(config);
    expect(out).toContain('assets:');
    expect(out).toContain('- assets/config.json');
    expect(out).toContain('- assets/images/');
  });

  it('does not emit assets section when config.assets is empty', () => {
    const config: AppConfig = { ...baseConfig, assets: [] };
    const out = pubspecYaml(config);
    const assetCount = (out.match(/- assets\//g) ?? []).length;
    expect(assetCount).toBe(0);
  });

  it('does not emit assets section when config.assets is undefined', () => {
    const out = pubspecYaml(baseConfig);
    expect(out).not.toContain('- assets/');
  });
});
