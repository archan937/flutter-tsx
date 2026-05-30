import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

import { logger } from '../cli/utils/logger.js';
import type { Links, ReleaseConfig } from '../config.js';
import {
  applyLinksToAndroidManifest,
  applyLinksToEntitlements,
  applyLinksToInfoPlist,
  normalizeLinks,
} from './links.js';
import { loadLocales, localesToL10nDart } from './locales.js';
import {
  applyToAndroidManifest,
  applyToInfoPlist,
  defaultPermissionDescription,
} from './permissions.js';

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
export const applyPermissions = (
  flutterDir: string,
  capabilities: string[],
  descriptions: Record<string, string> = {},
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
};

/**
 * Applies deep links + universal/app links (config/links.ts) to the native
 * projects: iOS CFBundleURLTypes (Info.plist) + associated-domains
 * (entitlements), and Android intent-filters (AndroidManifest). Idempotent.
 */
export const applyLinks = (flutterDir: string, links: Links): void => {
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

/**
 * Applies release/signing + push config (config/release.ts) to the native
 * projects: writes Android `key.properties` (passwords read from env vars, not
 * source) and copies the FCM config files into place.
 *
 * NOTE: the gradle `signingConfig` reference and the iOS `DEVELOPMENT_TEAM`
 * still need the standard one-time edits to build.gradle / the Xcode project —
 * those mutations are platform-version-specific and not auto-applied here.
 * This step prepares the credentials; it is not end-to-end verified (it needs
 * real keystores/certificates).
 */
export const applyRelease = (
  projectRoot: string,
  flutterDir: string,
  release: ReleaseConfig,
): void => {
  const abs = (p: string): string =>
    isAbsolute(p) ? p : resolve(projectRoot, p);

  if (release.android) {
    const { keystore, keyAlias, storePasswordEnv, keyPasswordEnv } =
      release.android;
    const storePassword = storePasswordEnv
      ? (process.env[storePasswordEnv] ?? '')
      : '';
    const keyPassword = keyPasswordEnv
      ? (process.env[keyPasswordEnv] ?? '')
      : storePassword;
    const keyProps = [
      `storeFile=${abs(keystore)}`,
      `keyAlias=${keyAlias}`,
      `storePassword=${storePassword}`,
      `keyPassword=${keyPassword}`,
      '',
    ].join('\n');
    writeFileSync(join(flutterDir, 'android', 'key.properties'), keyProps);
  }

  const copyInto = (src: string | undefined, dest: string): void => {
    if (!src) return;
    const from = abs(src);
    if (!existsSync(from)) {
      logger.warn(`config/release.ts: file not found, skipped: ${src}`);
      return;
    }
    if (!existsSync(dirname(dest)))
      mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(from, dest);
  };

  copyInto(
    release.push?.firebaseAndroid,
    join(flutterDir, 'android', 'app', 'google-services.json'),
  );
  copyInto(
    release.push?.firebaseIos,
    join(flutterDir, 'ios', 'Runner', 'GoogleService-Info.plist'),
  );
};
