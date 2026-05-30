/**
 * flutter.tsx — typed project configuration (`flutter-tsx/config`).
 *
 * A **types-only** module. The developer authors `config/*.ts` with a plain
 * literal validated by `satisfies` — full autocomplete + type-checking, zero
 * runtime indirection:
 *
 * ```ts
 * // config/app.ts
 * import type { AppConfig } from 'flutter-tsx/config';
 *
 * export default {
 *   name: 'my-app',
 *   bundleId: 'com.example.myapp',
 *   target: 'web',
 * } satisfies AppConfig;
 * ```
 *
 * `fsx` imports these modules at dev/build time — no second config language.
 */

/** Per-platform build settings (rare overrides; sensible defaults otherwise). */
export interface IosConfig {
  /** Minimum iOS deployment target, e.g. "13.0". */
  deploymentTarget?: string;
}

export interface AndroidConfig {
  /** Minimum Android SDK level, e.g. 21. */
  minSdk?: number;
}

export interface AppConfig {
  /** Name of the Flutter app (used in pubspec.yaml and as the window title). */
  name: string;
  /** Bundle/package identifier, e.g. "com.example.myapp". */
  bundleId?: string;
  /** Flutter version constraint, e.g. ">=3.0.0". */
  flutterVersion?: string;
  /** Default target device for `fsx dev`. */
  target?: 'web' | 'ios' | 'android' | 'macos' | 'linux' | 'windows';
  /** Extra Flutter pub dependencies to add to pubspec.yaml. */
  dependencies?: Record<string, string>;
  /** Source glob patterns to watch (default: ["src/**\/*.tsx"]). */
  watch?: string[];
  /** Output directory for generated Dart files (default: ".fsx/flutter/lib"). */
  outDir?: string;
  /** Flutter asset paths to include in pubspec.yaml flutter: assets: section. */
  assets?: string[];
  /** iOS-specific build overrides. */
  ios?: IosConfig;
  /** Android-specific build overrides. */
  android?: AndroidConfig;
}

// ---------------------------------------------------------------------------
// Surface config — semantic, platform-agnostic. One declaration fans out to
// the platform-specific native files (Info.plist, AndroidManifest, …) invisibly.
// ---------------------------------------------------------------------------

/** Material color roles (hex, e.g. "#54a4ff"). */
export interface ThemeColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  error?: string;
  background?: string;
  surface?: string;
}

/** `config/theme.ts` — brand colors → generated Material 3 ThemeData. */
export interface Theme {
  light: ThemeColors;
  dark?: ThemeColors;
}

/** `config/links.ts` — deep links + universal links (one declaration → both platforms). */
export interface Links {
  /** Custom URL scheme, e.g. "myapp" (→ myapp://…). */
  scheme?: string;
  /** Verified domains for universal/app links, e.g. ["example.com"]. */
  domains?: string[];
}

/** `config/env.ts` — build-time defines (→ `--dart-define`). May read `process.env`. */
export type EnvConfig = Record<string, string>;

/**
 * `config/permissions.ts` — capability → human-readable iOS usage description.
 * Usually unnecessary: permissions are inferred from the plugin hooks you use
 * (`useCamera()` → camera). Provide this only to customize the description
 * string or declare a permission no hook implies.
 */
export type Permissions = Record<string, string>;

/**
 * `config/release.ts` — signing + push credentials. The ONLY genuinely
 * platform-bound surface (an Apple profile vs an Android keystore can't be
 * merged). Reference credential files by path (keep them gitignored, e.g. under
 * `secrets/`); never hand-edit key.properties / Xcode / gradle. Passwords come
 * from environment variables, not source.
 */
export interface ReleaseConfig {
  android?: {
    /** Path to the keystore file, e.g. "secrets/app.keystore". */
    keystore: string;
    keyAlias: string;
    /** Env var name holding the keystore password (read at build time). */
    storePasswordEnv?: string;
    /** Env var name holding the key password (defaults to storePasswordEnv). */
    keyPasswordEnv?: string;
  };
  ios?: {
    /** Apple Developer Team ID used for signing. */
    teamId?: string;
  };
  push?: {
    /** Path to google-services.json (Android FCM). */
    firebaseAndroid?: string;
    /** Path to GoogleService-Info.plist (iOS FCM). */
    firebaseIos?: string;
  };
}
