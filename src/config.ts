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

// ---------------------------------------------------------------------------
// Platform config — `config/platforms/<os>.ts`. The escape hatch for the
// irreducibly OS-specific bits (build knobs, signing, FCM files) that have no
// cross-platform/semantic equivalent. Cross-platform values stay in app.ts /
// the semantic surfaces above; app.ts wins, platform files fill the leftovers.
// Credential FILES live in gitignored `signing/<os>/`, referenced by path;
// passwords come from environment variables, never source.
// ---------------------------------------------------------------------------

/** Android release keystore (paths into `signing/android/`). */
export interface AndroidSigning {
  /** Path to the keystore, e.g. "signing/android/release.jks". */
  keystore: string;
  keyAlias: string;
  /** Env var name holding the keystore password (read at build time). */
  storePasswordEnv?: string;
  /** Env var name holding the key password (defaults to storePasswordEnv). */
  keyPasswordEnv?: string;
}

/** macOS notarization (Apple notary service). */
export interface MacosNotarize {
  /** Apple Developer Team ID. */
  teamId: string;
  /** Env var name holding the Apple ID. */
  appleIdEnv?: string;
  /** Env var name holding the app-specific password. */
  passwordEnv?: string;
}

/** macOS Developer ID signing + optional notarization. */
export interface MacosSigning {
  /** Signing identity, e.g. "Developer ID Application: Acme (TEAMID)". */
  identity: string;
  notarize?: MacosNotarize;
}

/** Windows Authenticode signing (path into `signing/windows/`). */
export interface WindowsSigning {
  /** Path to the .pfx certificate, e.g. "signing/windows/cert.pfx". */
  certificate: string;
  /** Env var name holding the certificate password. */
  passwordEnv?: string;
}

export interface IosConfig {
  /** Minimum iOS deployment target, e.g. "13.0". */
  deploymentTarget?: string;
  /** Apple Developer Team ID used for signing. */
  teamId?: string;
  /** Path to GoogleService-Info.plist (iOS FCM). */
  firebase?: string;
}

export interface AndroidConfig {
  /** Minimum Android SDK level, e.g. 21. */
  minSdk?: number;
  /** Path to google-services.json (Android FCM). */
  firebase?: string;
  signing?: AndroidSigning;
}

export interface MacosConfig {
  /** Minimum macOS deployment target, e.g. "10.15". */
  deploymentTarget?: string;
  signing?: MacosSigning;
}

export interface WindowsConfig {
  signing?: WindowsSigning;
}

export interface LinuxConfig {
  /** Env var name holding a GPG key id for optional artifact signing. */
  signing?: { gpgKeyEnv?: string };
}
