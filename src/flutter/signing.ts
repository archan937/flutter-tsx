import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

import { logger } from '../cli/utils/logger.js';
import type { AndroidConfig, IosConfig } from '../config.js';

export const absPath = (root: string, p: string): string =>
  isAbsolute(p) ? p : resolve(root, p);

// ── Pure argv / file builders (exposed for testing) ─────────────────────────

/** gradle `android/key.properties` content (paths/passwords resolved by caller). */
export const androidKeyProperties = (opts: {
  storeFile: string;
  keyAlias: string;
  storePassword: string;
  keyPassword: string;
}): string =>
  [
    `storeFile=${opts.storeFile}`,
    `keyAlias=${opts.keyAlias}`,
    `storePassword=${opts.storePassword}`,
    `keyPassword=${opts.keyPassword}`,
    '',
  ].join('\n');

/** `codesign` argv to Developer ID-sign a built macOS .app with hardened runtime. */
export const codesignArgs = (
  identity: string,
  appPath: string,
  entitlements?: string,
): string[] => [
  'codesign',
  '--force',
  '--deep',
  '--options',
  'runtime',
  '--sign',
  identity,
  ...(entitlements ? ['--entitlements', entitlements] : []),
  appPath,
];

/** `xcrun notarytool submit --wait` argv. */
export const notarytoolArgs = (
  artifact: string,
  opts: { appleId: string; password: string; teamId: string },
): string[] => [
  'xcrun',
  'notarytool',
  'submit',
  artifact,
  '--apple-id',
  opts.appleId,
  '--password',
  opts.password,
  '--team-id',
  opts.teamId,
  '--wait',
];

/** Windows `signtool sign` argv (Authenticode, SHA256 + RFC-3161 timestamp). */
export const signtoolArgs = (
  artifact: string,
  opts: { certificate: string; passwordEnvValue?: string },
): string[] => [
  'signtool',
  'sign',
  '/fd',
  'SHA256',
  '/f',
  opts.certificate,
  ...(opts.passwordEnvValue ? ['/p', opts.passwordEnvValue] : []),
  '/tr',
  'http://timestamp.digicert.com',
  '/td',
  'SHA256',
  artifact,
];

// ── Integration: prepare native projects for a signed build ─────────────────

const copyInto = (
  root: string,
  src: string | undefined,
  dest: string,
): void => {
  if (!src) return;
  const from = absPath(root, src);
  if (!existsSync(from)) {
    logger.warn(`config/platforms: file not found, skipped: ${src}`);
    return;
  }
  if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
};

/**
 * Pre-build signing prep for Android: writes `android/key.properties` (gradle
 * reads it for release signing) and copies the FCM config into place. Passwords
 * come from env vars named in the config, never source. The gradle
 * `signingConfig` reference itself is a one-time project edit (documented).
 */
export const prepareAndroidSigning = (
  root: string,
  flutterDir: string,
  android: AndroidConfig,
): void => {
  if (android.signing) {
    const { keystore, keyAlias, storePasswordEnv, keyPasswordEnv } =
      android.signing;
    const storePassword = storePasswordEnv
      ? (process.env[storePasswordEnv] ?? '')
      : '';
    const keyPassword = keyPasswordEnv
      ? (process.env[keyPasswordEnv] ?? '')
      : storePassword;
    writeFileSync(
      join(flutterDir, 'android', 'key.properties'),
      androidKeyProperties({
        storeFile: absPath(root, keystore),
        keyAlias,
        storePassword,
        keyPassword,
      }),
    );
  }
  copyInto(
    root,
    android.firebase,
    join(flutterDir, 'android', 'app', 'google-services.json'),
  );
};

/** Pre-build signing prep for iOS: copies the FCM config into place. */
export const prepareIosSigning = (
  root: string,
  flutterDir: string,
  ios: IosConfig,
): void => {
  copyInto(
    root,
    ios.firebase,
    join(flutterDir, 'ios', 'Runner', 'GoogleService-Info.plist'),
  );
};
