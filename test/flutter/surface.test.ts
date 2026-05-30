import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  applyLinks,
  applyLocales,
  applyPermissions,
  loadSurfaceConfig,
} from '@src/flutter/surface.js';

const mkProject = (name: string, content: string | null): string => {
  const root = mkdtempSync(join(tmpdir(), 'fsx-surface-'));
  if (content !== null) {
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'config', `${name}.ts`), content, 'utf-8');
  }
  return root;
};

const EMPTY_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>CFBundleName</key>
\t<string>app</string>
</dict>
</plist>
`;

const EMPTY_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="app"></application>
</manifest>
`;

const plistPath = (dir: string): string =>
  join(dir, 'ios', 'Runner', 'Info.plist');
const manifestPath = (dir: string): string =>
  join(dir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const EMPTY_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
</dict>
</plist>
`;

const entitlementsPath = (dir: string): string =>
  join(dir, 'ios', 'Runner', 'Runner.entitlements');

const macosPlistPath = (dir: string): string =>
  join(dir, 'macos', 'Runner', 'Info.plist');
const macosEntitlementsPaths = (dir: string): string[] => [
  join(dir, 'macos', 'Runner', 'DebugProfile.entitlements'),
  join(dir, 'macos', 'Runner', 'Release.entitlements'),
];

const mkFlutterDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'fsx-applyperms-'));
  mkdirSync(join(dir, 'ios', 'Runner'), { recursive: true });
  mkdirSync(join(dir, 'android', 'app', 'src', 'main'), { recursive: true });
  mkdirSync(join(dir, 'macos', 'Runner'), { recursive: true });
  mkdirSync(join(dir, 'linux'), { recursive: true });
  mkdirSync(join(dir, 'windows'), { recursive: true });
  writeFileSync(plistPath(dir), EMPTY_PLIST);
  writeFileSync(entitlementsPath(dir), EMPTY_ENTITLEMENTS);
  writeFileSync(manifestPath(dir), EMPTY_MANIFEST);
  writeFileSync(macosPlistPath(dir), EMPTY_PLIST);
  for (const p of macosEntitlementsPaths(dir))
    writeFileSync(p, EMPTY_ENTITLEMENTS);
  return dir;
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

describe('applyPermissions', () => {
  it('writes inferred capabilities into Info.plist and AndroidManifest', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, ['camera']);
    const plist = readFileSync(plistPath(dir), 'utf-8');
    const manifest = readFileSync(manifestPath(dir), 'utf-8');
    expect(plist).toContain('NSCameraUsageDescription');
    expect(plist).toContain('This app uses the camera.'); // default description
    expect(manifest).toContain('android.permission.CAMERA');
  });

  it('uses a custom description from config when provided', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, ['camera'], {
      descriptions: { camera: 'Scan QR codes' },
    });
    expect(readFileSync(plistPath(dir), 'utf-8')).toContain('Scan QR codes');
  });

  it('wires macOS: usage string in Info.plist + sandbox entitlement (signing on)', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, ['camera'], { macosEntitlements: true });
    expect(readFileSync(macosPlistPath(dir), 'utf-8')).toContain(
      'NSCameraUsageDescription',
    );
    for (const p of macosEntitlementsPaths(dir)) {
      expect(readFileSync(p, 'utf-8')).toContain(
        'com.apple.security.device.camera',
      );
    }
  });

  it('writes macOS Info.plist but SKIPS entitlements when signing is off (build-safe default)', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, ['camera']);
    expect(readFileSync(macosPlistPath(dir), 'utf-8')).toContain(
      'NSCameraUsageDescription',
    );
    for (const p of macosEntitlementsPaths(dir)) {
      expect(readFileSync(p, 'utf-8')).not.toContain(
        'com.apple.security.device.camera',
      );
    }
  });

  it('is idempotent — re-running does not duplicate entries', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, ['camera']);
    applyPermissions(dir, ['camera']);
    const plist = readFileSync(plistPath(dir), 'utf-8');
    const count = plist.split('NSCameraUsageDescription').length - 1;
    expect(count).toBe(1);
  });

  it('does nothing when there are no capabilities', () => {
    const dir = mkFlutterDir();
    applyPermissions(dir, []);
    expect(readFileSync(plistPath(dir), 'utf-8')).not.toContain(
      'NSCameraUsageDescription',
    );
  });
});

describe('applyLinks', () => {
  it('writes scheme into Info.plist + AndroidManifest and domains into entitlements', () => {
    const dir = mkFlutterDir();
    applyLinks(dir, { scheme: 'myapp', domains: ['example.com'] });
    expect(readFileSync(plistPath(dir), 'utf-8')).toContain('myapp');
    expect(readFileSync(manifestPath(dir), 'utf-8')).toContain('myapp');
    expect(readFileSync(entitlementsPath(dir), 'utf-8')).toContain(
      'example.com',
    );
  });

  it('wires macOS: scheme in Info.plist always + domains in entitlements when signing on', () => {
    const dir = mkFlutterDir();
    applyLinks(dir, { scheme: 'myapp', domains: ['example.com'] });
    // Info.plist (scheme) always written...
    expect(readFileSync(macosPlistPath(dir), 'utf-8')).toContain('myapp');
    // ...but associated-domains entitlement skipped without signing.
    for (const p of macosEntitlementsPaths(dir)) {
      expect(readFileSync(p, 'utf-8')).not.toContain('example.com');
    }
    // With signing on, the entitlement is written.
    applyLinks(
      dir,
      { scheme: 'myapp', domains: ['example.com'] },
      {
        macosEntitlements: true,
      },
    );
    for (const p of macosEntitlementsPaths(dir)) {
      expect(readFileSync(p, 'utf-8')).toContain('example.com');
    }
  });

  it('emits Linux .desktop + Windows .reg scheme registration', () => {
    const dir = mkFlutterDir();
    applyLinks(dir, { scheme: 'myapp', domains: [] });
    expect(
      readFileSync(join(dir, 'linux', 'myapp.desktop'), 'utf-8'),
    ).toContain('x-scheme-handler/myapp;');
    expect(readFileSync(join(dir, 'windows', 'myapp.reg'), 'utf-8')).toContain(
      'Software\\Classes\\myapp',
    );
  });

  it('does nothing for an empty/invalid links config', () => {
    const dir = mkFlutterDir();
    applyLinks(dir, { scheme: 'https' });
    expect(readFileSync(plistPath(dir), 'utf-8')).not.toContain(
      'fsx:links:begin',
    );
  });
});

describe('applyLocales', () => {
  it('generates l10n.dart with a global t() from locales/', () => {
    const root = mkdtempSync(join(tmpdir(), 'fsx-locales-'));
    mkdirSync(join(root, 'locales'), { recursive: true });
    writeFileSync(
      join(root, 'locales', 'en.json'),
      JSON.stringify({ 'app.title': 'My App', greeting: 'Hi $name' }),
    );
    const outDir = join(root, 'out');
    const wrote = applyLocales(root, outDir);
    expect(wrote).toBe(true);
    const dart = readFileSync(join(outDir, 'l10n.dart'), 'utf-8');
    expect(dart).toContain('String t(String key)');
    expect(dart).toContain("'app.title': 'My App'");
    expect(dart).toContain('\\$name'); // $ escaped for Dart
  });

  it('returns false when there are no locales', () => {
    const root = mkdtempSync(join(tmpdir(), 'fsx-locales-'));
    expect(applyLocales(root, join(root, 'out'))).toBe(false);
  });
});
