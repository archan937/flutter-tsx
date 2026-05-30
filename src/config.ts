/**
 * flutter.tsx — typed project configuration (`flutter-tsx/config`).
 *
 * Authored by the developer in `config/app.ts`:
 *
 * ```ts
 * import { defineConfig } from 'flutter-tsx/config';
 *
 * export default defineConfig({
 *   name: 'my-app',
 *   bundleId: 'com.example.myapp',
 *   target: 'web',
 * });
 * ```
 *
 * `fsx` imports this module at dev/build time — no second config language,
 * full autocomplete and type-checking on every field.
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

/**
 * Identity helper for `config/app.ts` — returns the config unchanged while
 * giving the developer full type-checking and autocomplete.
 */
export const defineConfig = (config: AppConfig): AppConfig => config;
