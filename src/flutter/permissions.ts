import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface PermissionMapping {
  ios?: string[];
  android?: string[];
  privacy?: boolean;
}

export const PERMISSION_MAP: Record<string, PermissionMapping> = {
  camera: {
    ios: ['NSCameraUsageDescription'],
    android: ['android.permission.CAMERA'],
  },
  microphone: {
    ios: ['NSMicrophoneUsageDescription'],
    android: ['android.permission.RECORD_AUDIO'],
  },
  location: {
    ios: ['NSLocationWhenInUseUsageDescription'],
    android: ['android.permission.ACCESS_FINE_LOCATION'],
  },
  location_always: {
    ios: [
      'NSLocationAlwaysUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
    ],
    android: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
  },
  photos: {
    ios: [
      'NSPhotoLibraryUsageDescription',
      'NSPhotoLibraryAddUsageDescription',
    ],
    android: ['android.permission.READ_EXTERNAL_STORAGE'],
  },
  contacts: {
    ios: ['NSContactsUsageDescription'],
    android: ['android.permission.READ_CONTACTS'],
  },
  calendar: {
    ios: ['NSCalendarsUsageDescription'],
    android: [
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
    ],
  },
  bluetooth: {
    ios: ['NSBluetoothAlwaysUsageDescription'],
    android: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
    ],
  },
  notifications: { ios: [], android: [] },
  face_id: { ios: ['NSFaceIDUsageDescription'], android: [] },
  tracking: {
    ios: ['NSUserTrackingUsageDescription'],
    android: [],
    privacy: true,
  },
};

const FSX_BEGIN = '<!-- fsx:permissions:begin -->';
const FSX_END = '<!-- fsx:permissions:end -->';
const FSX_PRIVACY_BEGIN = '<!-- fsx:privacy:begin -->';
const FSX_PRIVACY_END = '<!-- fsx:privacy:end -->';

export const loadPermissions = (
  projectRoot: string,
): Record<string, string> => {
  const path = join(projectRoot, 'permissions.toml');
  if (!existsSync(path)) return {};

  const content = readFileSync(path, 'utf-8');
  const result: Record<string, string> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"$/.exec(line);
    if (!match) continue;

    const [, key, value] = match;
    if (!(key in PERMISSION_MAP)) {
      logger.warn(`permissions.toml: unknown key "${key}" ignored`);
      continue;
    }
    if (value === '') {
      logger.error(`permissions.toml: ${key} has empty usage description`);
      continue;
    }
    result[key] = value;
  }

  return result;
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stripFsxBlock = (
  content: string,
  beginMarker: string,
  endMarker: string,
): string => {
  const beginIdx = content.indexOf(beginMarker);
  if (beginIdx < 0) return content;
  const endIdx = content.indexOf(endMarker, beginIdx);
  if (endIdx < 0) return content;
  // Find the start of the line containing the begin marker (strip any leading whitespace)
  let lineStart = beginIdx;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart -= 1;
  // Find the end of the line containing the end marker (include trailing newline)
  let lineEnd = endIdx + endMarker.length;
  if (content[lineEnd] === '\n') lineEnd += 1;
  return content.slice(0, lineStart) + content.slice(lineEnd);
};

export const applyToInfoPlist = (
  plistXml: string,
  permissions: Record<string, string>,
): string => {
  const stripped = stripFsxBlock(plistXml, FSX_BEGIN, FSX_END);

  const entries: { key: string; description: string }[] = [];
  for (const [permKey, description] of Object.entries(permissions)) {
    const mapping = PERMISSION_MAP[permKey];
    if (!mapping) continue;
    for (const iosKey of mapping.ios ?? []) {
      entries.push({ key: iosKey, description });
    }
  }
  if (entries.length === 0) return stripped;

  entries.sort((a, b) => a.key.localeCompare(b.key));

  const block =
    [
      FSX_BEGIN,
      ...entries.flatMap((entry) => [
        `<key>${entry.key}</key>`,
        `<string>${escapeXml(entry.description)}</string>`,
      ]),
      FSX_END,
    ].join('\n') + '\n';

  // Insert before the closing </dict> of the top-level <plist><dict>
  const dictCloseIdx = stripped.lastIndexOf('</dict>');
  if (dictCloseIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, dictCloseIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};

export const applyToPrivacyManifest = (
  manifestXml: string,
  permissions: Record<string, string>,
): string => {
  const stripped = stripFsxBlock(
    manifestXml,
    FSX_PRIVACY_BEGIN,
    FSX_PRIVACY_END,
  );

  const privacyKeys = Object.keys(permissions).filter(
    (k) => PERMISSION_MAP[k]?.privacy === true,
  );
  if (privacyKeys.length === 0) return stripped;

  const block =
    [
      FSX_PRIVACY_BEGIN,
      `<key>NSPrivacyAccessedAPITypes</key>`,
      `<array>`,
      ...privacyKeys.flatMap((key) => [
        `  <dict>`,
        `    <key>NSPrivacyAccessedAPIType</key>`,
        `    <string>${escapeXml(key)}</string>`,
        `  </dict>`,
      ]),
      `</array>`,
      FSX_PRIVACY_END,
    ].join('\n') + '\n';

  const dictCloseIdx = stripped.lastIndexOf('</dict>');
  if (dictCloseIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, dictCloseIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};

export const applyToAndroidManifest = (
  manifestXml: string,
  permissions: Record<string, string>,
): string => {
  const stripped = stripFsxBlock(manifestXml, FSX_BEGIN, FSX_END);

  const androidKeys = new Set<string>();
  for (const permKey of Object.keys(permissions)) {
    const mapping = PERMISSION_MAP[permKey];
    if (!mapping) continue;
    for (const androidKey of mapping.android ?? []) {
      androidKeys.add(androidKey);
    }
  }
  if (androidKeys.size === 0) return stripped;

  const sortedKeys = [...androidKeys].sort();
  const block =
    [
      FSX_BEGIN,
      ...sortedKeys.map((key) => `<uses-permission android:name="${key}"/>`),
      FSX_END,
    ].join('\n') + '\n';

  const manifestCloseIdx = stripped.indexOf('</manifest>');
  if (manifestCloseIdx < 0) return stripped;
  const lineStart = findLineStart(stripped, manifestCloseIdx);
  return stripped.slice(0, lineStart) + block + stripped.slice(lineStart);
};

const findLineStart = (content: string, idx: number): number => {
  let i = idx;
  while (i > 0 && content[i - 1] !== '\n') i -= 1;
  return i;
};
