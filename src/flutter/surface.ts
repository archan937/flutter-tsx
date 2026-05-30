import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { Links } from '../config.js';
import {
  applyLinksToAndroidManifest,
  applyLinksToEntitlements,
  applyLinksToInfoPlist,
  normalizeLinks,
} from './links.js';
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
