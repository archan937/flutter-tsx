export interface AppConfig {
  /** Name of the Flutter app (used in pubspec.yaml and as the window title) */
  name: string;
  /** Bundle/package identifier, e.g. "com.example.myapp" */
  bundleId?: string;
  /** Flutter version constraint, e.g. ">=3.0.0" */
  flutterVersion?: string;
  /** Default target device for `fsx dev` */
  target?: 'web' | 'ios' | 'android' | 'macos' | 'linux' | 'windows';
  /** Extra Flutter pub dependencies to add to pubspec.yaml */
  dependencies?: Record<string, string>;
  /** Source glob patterns to watch (default: ["src/**\/*.tsx"]) */
  watch?: string[];
  /** Output directory for generated Dart files (default: ".fsx/flutter/lib") */
  outDir?: string;
}
