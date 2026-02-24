/**
 * Generates the default app.toml configuration file.
 */
export function appToml(appName: string, bundleId: string, target = "web"): string {
  return `# flutter.tsx configuration
name = "${appName}"
bundleId = "${bundleId}"
target = "${target}"

# Flutter version constraint
flutterVersion = ">=3.0.0"

# Source files to watch
watch = ["src/**/*.tsx"]

# Output directory for generated Dart files
outDir = ".fsx/flutter/lib"

# Extra Flutter pub dependencies
# [dependencies]
# http = "^1.2.0"
`;
}
