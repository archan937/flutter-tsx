import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { AppConfig } from "../../types/app-toml.js";
import { pubspecYaml } from "../templates/pubspec-yaml.js";
import { mainDart } from "../templates/main-dart.js";

/**
 * Ensures the internal Flutter project at `.fsx/flutter` exists and is up to date.
 * This is idempotent — safe to call on every `fsx dev` start.
 */
export async function ensureFlutterProject(
  flutterDir: string,
  config: AppConfig,
  flutterBin = "flutter"
): Promise<void> {
  const libDir = join(flutterDir, "lib");
  const pubspecPath = join(flutterDir, "pubspec.yaml");
  const mainDartPath = join(libDir, "main.dart");

  const needsInit = !existsSync(pubspecPath);

  if (needsInit) {
    // Run flutter create
    const appName = config.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const proc = Bun.spawn(
      [flutterBin, "create", "--project-name", appName, "--no-pub", flutterDir],
      { stdout: "pipe", stderr: "pipe" }
    );
    await proc.exited;
    if (proc.exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`flutter create failed: ${err}`);
    }
  }

  // Always overwrite pubspec.yaml and main.dart so the app runs the user's TSX entry (App.dart)
  mkdirSync(libDir, { recursive: true });
  writeFileSync(pubspecPath, pubspecYaml(config), "utf-8");
  writeFileSync(mainDartPath, mainDart(), "utf-8");

  // Run flutter pub get
  const pubGet = Bun.spawn([flutterBin, "pub", "get"], {
    cwd: flutterDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await pubGet.exited;

  if (pubGet.exitCode !== 0) {
    const err = await new Response(pubGet.stderr).text();
    console.warn(`flutter pub get warning: ${err}`);
  }
}

/**
 * Scaffolds a new user project directory.
 * Called by `fsx init`.
 */
export async function scaffoldUserProject(
  projectDir: string,
  config: {
    name: string;
    bundleId: string;
    target: string;
  }
): Promise<void> {
  const { appTsx } = await import("../templates/app-tsx.js");
  const { appToml } = await import("../templates/app-toml.js");
  const { userPackageJson } = await import("../templates/user-package-json.js");
  const { userTsconfig } = await import("../templates/user-tsconfig.js");
  const { gitignore } = await import("../templates/gitignore.js");

  const srcDir = join(projectDir, "src");
  const testDir = join(projectDir, "tests");

  mkdirSync(srcDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });

  // src/App.tsx
  writeFileSync(join(srcDir, "App.tsx"), appTsx(config.name), "utf-8");

  // app.toml
  writeFileSync(
    join(projectDir, "app.toml"),
    appToml(config.name, config.bundleId, config.target),
    "utf-8"
  );

  // package.json
  writeFileSync(
    join(projectDir, "package.json"),
    userPackageJson(config.name),
    "utf-8"
  );

  // tsconfig.json
  writeFileSync(
    join(projectDir, "tsconfig.json"),
    userTsconfig(),
    "utf-8"
  );

  // .gitignore
  writeFileSync(join(projectDir, ".gitignore"), gitignore(), "utf-8");
}
