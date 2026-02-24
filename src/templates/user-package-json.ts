/**
 * Generates the package.json for a new user project.
 */
export function userPackageJson(appName: string): string {
  const pkg = {
    name: appName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "fsx dev",
      "dev:ios": "fsx dev --target=ios",
      "dev:android": "fsx dev --target=android",
      "dev:macos": "fsx dev --target=macos",
      "dev:web": "fsx dev --target=web",
      build: "fsx build",
    },
    dependencies: {
      "@tsx/flutter": "^0.1.0",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}
