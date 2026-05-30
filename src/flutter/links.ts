import { logger } from '../cli/utils/logger.js';
import type { Links } from '../config.js';

export interface AppLinks {
  scheme: string | null;
  domains: string[];
}

const SCHEME_RE = /^[a-z][a-z0-9+\-.]*$/;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const RESERVED_SCHEMES = new Set(['http', 'https']);

const FSX_LINKS_BEGIN = '<!-- fsx:links:begin -->';
const FSX_LINKS_END = '<!-- fsx:links:end -->';

const findLineStart = (content: string, idx: number): number => {
  let i = idx;
  while (i > 0 && content[i - 1] !== '\n') i -= 1;
  return i;
};

const stripFsxBlock = (
  content: string,
  beginMarker: string,
  endMarker: string,
): string => {
  const beginIdx = content.indexOf(beginMarker);
  if (beginIdx < 0) return content;
  const endIdx = content.indexOf(endMarker, beginIdx);
  if (endIdx < 0) return content;
  const lineStart = findLineStart(content, beginIdx);
  let lineEnd = endIdx + endMarker.length;
  if (content[lineEnd] === '\n') lineEnd += 1;
  return content.slice(0, lineStart) + content.slice(lineEnd);
};

/**
 * Validates + normalizes a typed `config/links.ts` into `AppLinks`. Invalid
 * schemes/domains are dropped with a warning (rather than producing broken
 * native config). Returns null when nothing valid remains.
 */
export const normalizeLinks = (links: Links): AppLinks | null => {
  const { scheme: rawScheme, domains: rawDomains = [] } = links;

  let scheme: string | null = null;
  if (rawScheme !== undefined) {
    if (SCHEME_RE.test(rawScheme) && !RESERVED_SCHEMES.has(rawScheme)) {
      scheme = rawScheme;
    } else {
      logger.warn(`config/links.ts: invalid scheme "${rawScheme}" ignored`);
    }
  }

  const domains: string[] = [];
  const seen = new Set<string>();
  for (const domain of rawDomains) {
    if (!DOMAIN_RE.test(domain)) {
      logger.warn(`config/links.ts: invalid domain "${domain}" ignored`);
      continue;
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }

  if (scheme === null && domains.length === 0) return null;
  return { scheme, domains };
};

export const applyLinksToInfoPlist = (
  plistXml: string,
  links: AppLinks,
): string => {
  const stripped = stripFsxBlock(plistXml, FSX_LINKS_BEGIN, FSX_LINKS_END);
  if (links.scheme === null) return stripped;

  const block =
    [
      FSX_LINKS_BEGIN,
      `<key>CFBundleURLTypes</key>`,
      `<array>`,
      `  <dict>`,
      `    <key>CFBundleURLSchemes</key>`,
      `    <array>`,
      `      <string>${links.scheme}</string>`,
      `    </array>`,
      `  </dict>`,
      `</array>`,
      FSX_LINKS_END,
    ].join('\n') + '\n';

  const dictCloseIdx = stripped.lastIndexOf('</dict>');
  if (dictCloseIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, dictCloseIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};

export const applyLinksToEntitlements = (
  entXml: string,
  links: AppLinks,
): string => {
  const stripped = stripFsxBlock(entXml, FSX_LINKS_BEGIN, FSX_LINKS_END);
  if (links.domains.length === 0) return stripped;

  const sortedDomains = [...links.domains].sort();
  const block =
    [
      FSX_LINKS_BEGIN,
      `<key>com.apple.developer.associated-domains</key>`,
      `<array>`,
      ...sortedDomains.map((d) => `  <string>applinks:${d}</string>`),
      `</array>`,
      FSX_LINKS_END,
    ].join('\n') + '\n';

  const dictCloseIdx = stripped.lastIndexOf('</dict>');
  if (dictCloseIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, dictCloseIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};

/**
 * Linux registers a custom URI scheme via a `.desktop` entry's
 * `x-scheme-handler/<scheme>` MIME type. fsx emits the entry; wiring it into the
 * desktop database is an install-time step (handled by the packager).
 */
export const linuxDesktopEntry = (scheme: string, appName = scheme): string =>
  [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${appName}`,
    `Exec=${appName} %u`,
    'NoDisplay=true',
    `MimeType=x-scheme-handler/${scheme};`,
    '',
  ].join('\n');

/**
 * Windows registers a custom URI scheme under `HKCU\Software\Classes\<scheme>`
 * with a `URL Protocol` value. fsx emits the `.reg`; importing it (or doing the
 * equivalent write from the installer) is an install-time step.
 */
export const windowsSchemeReg = (scheme: string, appName = scheme): string =>
  [
    'Windows Registry Editor Version 5.00',
    '',
    `[HKEY_CURRENT_USER\\Software\\Classes\\${scheme}]`,
    `@="URL:${appName} Protocol"`,
    '"URL Protocol"=""',
    '',
    `[HKEY_CURRENT_USER\\Software\\Classes\\${scheme}\\shell\\open\\command]`,
    `@="\\"${appName}.exe\\" \\"%1\\""`,
    '',
  ].join('\n');

export const applyLinksToAndroidManifest = (
  manifestXml: string,
  links: AppLinks,
): string => {
  const stripped = stripFsxBlock(manifestXml, FSX_LINKS_BEGIN, FSX_LINKS_END);
  if (links.scheme === null && links.domains.length === 0) return stripped;

  const parts: string[] = [FSX_LINKS_BEGIN];
  if (links.scheme !== null) {
    parts.push(`<intent-filter>`);
    parts.push(`  <action android:name="android.intent.action.VIEW"/>`);
    parts.push(`  <category android:name="android.intent.category.DEFAULT"/>`);
    parts.push(
      `  <category android:name="android.intent.category.BROWSABLE"/>`,
    );
    parts.push(`  <data android:scheme="${links.scheme}"/>`);
    parts.push(`</intent-filter>`);
  }
  for (const domain of [...links.domains].sort()) {
    parts.push(`<intent-filter android:autoVerify="true">`);
    parts.push(`  <action android:name="android.intent.action.VIEW"/>`);
    parts.push(`  <category android:name="android.intent.category.DEFAULT"/>`);
    parts.push(
      `  <category android:name="android.intent.category.BROWSABLE"/>`,
    );
    parts.push(`  <data android:scheme="https" android:host="${domain}"/>`);
    parts.push(`</intent-filter>`);
  }
  parts.push(FSX_LINKS_END);
  const block = parts.join('\n') + '\n';

  // Insert before </activity> if present, otherwise before </manifest>
  const activityCloseIdx = stripped.indexOf('</activity>');
  const insertIdx =
    activityCloseIdx >= 0 ? activityCloseIdx : stripped.indexOf('</manifest>');
  if (insertIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, insertIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};
