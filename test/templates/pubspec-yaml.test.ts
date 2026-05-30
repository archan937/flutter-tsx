import { describe, expect, it } from 'bun:test';

import type { DetectedAssets } from '@src/flutter/assets.js';
import type { FontMap } from '@src/flutter/fonts.js';
import { pubspecYaml } from '@src/templates/pubspec-yaml.js';

import type { AppConfig } from '../../types/app-toml.js';

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

describe('pubspecYaml — brand assets (DetectedAssets)', () => {
  it('default ({}) → no mention of flutter_launcher_icons or flutter_native_splash', () => {
    const out = pubspecYaml(baseConfig);
    expect(out).not.toContain('flutter_launcher_icons');
    expect(out).not.toContain('flutter_native_splash');
  });

  it('icon: true → emits flutter_launcher_icons dev dep and config block', () => {
    const out = pubspecYaml(baseConfig, [], { assets: { icon: true } });
    expect(out).toContain('flutter_launcher_icons: ^0.14.1');
    expect(out).toContain('flutter_launcher_icons:');
    expect(out).toContain('.fsx-assets/icons/icon.png');
  });

  it('icon: true → cascades to flutter_native_splash with icon.png as image', () => {
    const out = pubspecYaml(baseConfig, [], { assets: { icon: true } });
    expect(out).toContain('flutter_native_splash: ^2.4.3');
    expect(out).toContain("image: '.fsx-assets/icons/icon.png'");
  });

  it('splash: true (no icon) → only flutter_native_splash with splash.png', () => {
    const out = pubspecYaml(baseConfig, [], { assets: { splash: true } });
    expect(out).toContain('flutter_native_splash: ^2.4.3');
    expect(out).toContain("image: '.fsx-assets/icons/splash.png'");
    expect(out).not.toContain('flutter_launcher_icons');
  });

  it('icon + splash → splash engine uses splash.png (not cascaded icon)', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, splash: true },
    });
    expect(out).toContain("image: '.fsx-assets/icons/splash.png'");
  });

  it('icon + background → adaptive_icon_background uses background.png, not #ffffff', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, background: true },
    });
    expect(out).toContain(
      "adaptive_icon_background: '.fsx-assets/icons/background.png'",
    );
    expect(out).toContain(
      "background_image: '.fsx-assets/icons/background.png'",
    );
    expect(out).not.toContain("adaptive_icon_background: '#ffffff'");
  });

  it('icon only (no background) → adaptive_icon_background defaults to #ffffff', () => {
    const out = pubspecYaml(baseConfig, [], { assets: { icon: true } });
    expect(out).toContain("adaptive_icon_background: '#ffffff'");
  });

  it('icon + monochrome → adaptive_icon_monochrome present', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, monochrome: true },
    });
    expect(out).toContain(
      "adaptive_icon_monochrome: '.fsx-assets/icons/monochrome.png'",
    );
  });

  it('icon + iconDark → image_path_dark present in launcher block', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, iconDark: true },
    });
    expect(out).toContain("image_path_dark: '.fsx-assets/icons/dark/icon.png'");
  });

  it('icon + backgroundDark → adaptive_icon_background_dark present', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, backgroundDark: true },
    });
    expect(out).toContain(
      "adaptive_icon_background_dark: '.fsx-assets/icons/dark/background.png'",
    );
  });

  it('icon + monochromeDark → adaptive_icon_monochrome_dark present', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, monochromeDark: true },
    });
    expect(out).toContain(
      "adaptive_icon_monochrome_dark: '.fsx-assets/icons/dark/monochrome.png'",
    );
  });

  it('icon + splashDark → image_dark present in splash block', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, splashDark: true },
    });
    expect(out).toContain("image_dark: '.fsx-assets/icons/dark/splash.png'");
  });

  it('icon + backgroundDark → background_image_dark present in splash block', () => {
    const out = pubspecYaml(baseConfig, [], {
      assets: { icon: true, backgroundDark: true },
    });
    expect(out).toContain(
      "background_image_dark: '.fsx-assets/icons/dark/background.png'",
    );
  });

  it('all 8 keys true → all light + dark blocks present', () => {
    const all: DetectedAssets = {
      icon: true,
      splash: true,
      background: true,
      monochrome: true,
      iconDark: true,
      splashDark: true,
      backgroundDark: true,
      monochromeDark: true,
    };
    const out = pubspecYaml(baseConfig, [], { assets: all });
    expect(out).toContain('flutter_launcher_icons: ^0.14.1');
    expect(out).toContain('flutter_native_splash: ^2.4.3');
    expect(out).toContain("image_path: '.fsx-assets/icons/icon.png'");
    expect(out).toContain("image_path_dark: '.fsx-assets/icons/dark/icon.png'");
    expect(out).toContain(
      "adaptive_icon_background: '.fsx-assets/icons/background.png'",
    );
    expect(out).toContain(
      "adaptive_icon_background_dark: '.fsx-assets/icons/dark/background.png'",
    );
    expect(out).toContain(
      "adaptive_icon_monochrome: '.fsx-assets/icons/monochrome.png'",
    );
    expect(out).toContain(
      "adaptive_icon_monochrome_dark: '.fsx-assets/icons/dark/monochrome.png'",
    );
    expect(out).toContain("image: '.fsx-assets/icons/splash.png'");
    expect(out).toContain("image_dark: '.fsx-assets/icons/dark/splash.png'");
    expect(out).toContain(
      "background_image: '.fsx-assets/icons/background.png'",
    );
    expect(out).toContain(
      "background_image_dark: '.fsx-assets/icons/dark/background.png'",
    );
  });

  it('existing call sites unchanged when third arg omitted', () => {
    const out1 = pubspecYaml(baseConfig, ['provider: ^6.0.0']);
    expect(out1).toContain('provider: ^6.0.0');
    expect(out1).not.toContain('flutter_launcher_icons');
  });
});

describe('pubspecYaml — legal assets', () => {
  it('includes privacy.md in flutter assets when legal.privacy is true', () => {
    const out = pubspecYaml(baseConfig, [], { legal: { privacy: true } });
    expect(out).toContain('assets/legal/privacy.md');
  });

  it('includes both legal files when present', () => {
    const out = pubspecYaml(baseConfig, [], {
      legal: { privacy: true, terms: true },
    });
    expect(out).toContain('assets/legal/privacy.md');
    expect(out).toContain('assets/legal/terms.md');
  });

  it('omits legal files when neither flag is true', () => {
    const out = pubspecYaml(baseConfig, [], {
      legal: { privacy: false, terms: false },
    });
    expect(out).not.toContain('assets/legal');
  });
});

describe('pubspecYaml — fonts', () => {
  it('default (no fonts arg) → no flutter: fonts: block', () => {
    const out = pubspecYaml(baseConfig);
    expect(out).not.toContain('fonts:\n');
  });

  it('emits a fonts block for a single family', () => {
    const fonts: FontMap = {
      Inter: [{ weight: 400, italic: false, file: 'Inter-Regular.ttf' }],
    };
    const out = pubspecYaml(baseConfig, [], { fonts });
    expect(out).toContain('fonts:');
    expect(out).toContain('- family: Inter');
    expect(out).toContain('asset: .fsx-fonts/Inter-Regular.ttf');
    expect(out).toContain('weight: 400');
  });

  it('emits two family entries in alphabetical order', () => {
    const fonts: FontMap = {
      JetBrainsMono: [
        { weight: 400, italic: false, file: 'JetBrainsMono-Regular.ttf' },
      ],
      Inter: [{ weight: 400, italic: false, file: 'Inter-Regular.ttf' }],
    };
    const out = pubspecYaml(baseConfig, [], { fonts });
    const interIdx = out.indexOf('- family: Inter');
    const jbIdx = out.indexOf('- family: JetBrainsMono');
    expect(interIdx).toBeGreaterThan(-1);
    expect(jbIdx).toBeGreaterThan(interIdx);
  });
});
