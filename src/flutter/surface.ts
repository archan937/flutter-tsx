import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { Links } from '../config.js';
import {
  applyLinksToAndroidManifest,
  applyLinksToEntitlements,
  applyLinksToInfoPlist,
  linuxDesktopEntry,
  normalizeLinks,
  windowsSchemeReg,
} from './links.js';
import { loadLocales, localesToL10nDart } from './locales.js';
import {
  applyToAndroidManifest,
  applyToInfoPlist,
  applyToMacosEntitlements,
  defaultPermissionDescription,
} from './permissions.js';

const MACOS_ENTITLEMENT_FILES = [
  'DebugProfile.entitlements',
  'Release.entitlements',
];

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

/**
 * Imports the optional platform escape-hatch config `config/platforms/<os>.ts`
 * (OS-specific build knobs + signing). Returns its default export, or null when
 * absent. Cross-platform values live in `config/app.ts` / the semantic surfaces
 * (which win); this fills only the irreducibly-OS-specific leftovers.
 */
export const loadPlatformConfig = async <T>(
  root: string,
  os: string,
): Promise<T | null> => {
  const configPath = join(root, 'config', 'platforms', `${os}.ts`);
  if (!existsSync(configPath)) return null;

  const mod = (await import(configPath)) as { default?: T };
  return mod.default ?? null;
};

const mutateFile = (path: string, fn: (xml: string) => string): void => {
  if (!existsSync(path)) return;
  writeFileSync(path, fn(readFileSync(path, 'utf-8')), 'utf-8');
};

/**
 * Applies permissions to the generated native projects. Capabilities are
 * inferred from used plugin hooks (`useCamera()` → camera); `descriptions`
 * (from optional config/permissions.ts) customize the iOS usage strings, with
 * sensible defaults otherwise. Idempotent — the appliers use `<!-- fsx -->`
 * markers, so re-running replaces the managed block cleanly.
 */
/**
 * Options controlling platform-specific surface application.
 * `macosEntitlements`: write macOS sandbox/associated-domains entitlements.
 * macOS entitlements REQUIRE code signing to build, so they are written only
 * when `config/platforms/macos.ts` configures signing — otherwise an unsigned
 * `flutter build macos` fails ("entitlements require a development certificate").
 * The Info.plist usage strings / URL schemes are always safe and always written.
 */
export interface SurfaceOptions {
  macosEntitlements?: boolean;
}

export const applyPermissions = (
  flutterDir: string,
  capabilities: string[],
  {
    descriptions = {},
    macosEntitlements = false,
  }: SurfaceOptions & { descriptions?: Record<string, string> } = {},
): void => {
  const caps = new Set([...capabilities, ...Object.keys(descriptions)]);
  if (caps.size === 0) return;

  const permissions: Record<string, string> = {};
  for (const cap of caps) {
    permissions[cap] = descriptions[cap] ?? defaultPermissionDescription(cap);
  }

  mutateFile(join(flutterDir, 'ios', 'Runner', 'Info.plist'), (xml) =>
    applyToInfoPlist(xml, permissions),
  );
  mutateFile(
    join(flutterDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    (xml) => applyToAndroidManifest(xml, permissions),
  );

  // macOS: the NS*UsageDescription strings always; sandbox entitlements only
  // when signing is configured (they require a signing cert to build).
  mutateFile(join(flutterDir, 'macos', 'Runner', 'Info.plist'), (xml) =>
    applyToInfoPlist(xml, permissions),
  );
  if (macosEntitlements) {
    const macosCaps = Object.keys(permissions);
    for (const file of MACOS_ENTITLEMENT_FILES) {
      mutateFile(join(flutterDir, 'macos', 'Runner', file), (xml) =>
        applyToMacosEntitlements(xml, macosCaps),
      );
    }
  }
  // Windows/Linux: the OS does not gate capabilities behind a manifest, so
  // there is intentionally nothing to write (see config-mapping docs).
};

/**
 * Applies deep links + universal/app links (config/links.ts) to the native
 * projects: iOS CFBundleURLTypes (Info.plist) + associated-domains
 * (entitlements), and Android intent-filters (AndroidManifest). Idempotent.
 */
export const applyLinks = (
  flutterDir: string,
  links: Links,
  { macosEntitlements = false }: SurfaceOptions = {},
): void => {
  const normalized = normalizeLinks(links);
  if (!normalized) return;

  mutateFile(join(flutterDir, 'ios', 'Runner', 'Info.plist'), (xml) =>
    applyLinksToInfoPlist(xml, normalized),
  );
  mutateFile(join(flutterDir, 'ios', 'Runner', 'Runner.entitlements'), (xml) =>
    applyLinksToEntitlements(xml, normalized),
  );
  mutateFile(
    join(flutterDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    (xml) => applyLinksToAndroidManifest(xml, normalized),
  );

  // macOS: CFBundleURLTypes (Info.plist) always; associated-domains entitlement
  // only when signing is configured (it requires a signing cert to build).
  mutateFile(join(flutterDir, 'macos', 'Runner', 'Info.plist'), (xml) =>
    applyLinksToInfoPlist(xml, normalized),
  );
  if (macosEntitlements) {
    for (const file of MACOS_ENTITLEMENT_FILES) {
      mutateFile(join(flutterDir, 'macos', 'Runner', file), (xml) =>
        applyLinksToEntitlements(xml, normalized),
      );
    }
  }

  // Windows/Linux custom-scheme registration (install-time artifacts fsx emits).
  if (normalized.scheme !== null) {
    writeIfDirExists(
      join(flutterDir, 'linux'),
      `${normalized.scheme}.desktop`,
      linuxDesktopEntry(normalized.scheme),
    );
    writeIfDirExists(
      join(flutterDir, 'windows'),
      `${normalized.scheme}.reg`,
      windowsSchemeReg(normalized.scheme),
    );
  }
};

const writeIfDirExists = (dir: string, file: string, content: string): void => {
  if (!existsSync(dir)) return;
  writeFileSync(join(dir, file), content, 'utf-8');
};

/**
 * Generates `<outDir>/l10n.dart` (the global `t(key)` resolver) from the
 * project's `locales/*.json`, so `useTranslations()` works. Returns true when a
 * file was written (i.e. locales exist).
 */
export const applyLocales = (projectRoot: string, outDir: string): boolean => {
  const data = loadLocales(projectRoot);
  if (!data) return false;
  const outPath = join(outDir, 'l10n.dart');
  if (!existsSync(dirname(outPath)))
    mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, localesToL10nDart(data), 'utf-8');
  return true;
};
