import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { AppConfig } from '../../types/app-toml.js';
import { mainDart } from '../templates/main-dart.js';
import { pubspecYaml } from '../templates/pubspec-yaml.js';
import { detectAssets, generateAssets, hashFile } from './assets.js';
import { detectFonts, type FontMap } from './fonts.js';

export interface EnsureFlutterProjectOptions {
  flutterBin?: string;
  extraDeps?: string[];
  projectRoot?: string;
  dartBin?: string;
}

export const ensureFlutterProject = async (
  flutterDir: string,
  config: AppConfig,
  {
    flutterBin = 'flutter',
    extraDeps = [],
    projectRoot,
    dartBin,
  }: EnsureFlutterProjectOptions = {},
): Promise<void> => {
  const libDir = join(flutterDir, 'lib');
  const pubspecPath = join(flutterDir, 'pubspec.yaml');
  const mainDartPath = join(libDir, 'main.dart');

  const needsInit = !existsSync(pubspecPath);

  if (needsInit) {
    const appName = config.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const proc = Bun.spawn(
      [flutterBin, 'create', '--project-name', appName, '--no-pub', flutterDir],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    await proc.exited;
    if (proc.exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`flutter create failed: ${err}`);
    }
  }

  const assets = projectRoot ? detectAssets(projectRoot) : {};
  const fonts: FontMap = projectRoot ? detectFonts(projectRoot) : {};

  if (projectRoot && Object.keys(fonts).length > 0) {
    await syncFonts(projectRoot, flutterDir, fonts);
  }

  mkdirSync(libDir, { recursive: true });
  writeFileSync(
    pubspecPath,
    pubspecYaml(config, extraDeps, { assets, fonts }),
    'utf-8',
  );
  writeFileSync(mainDartPath, mainDart(), 'utf-8');

  const pubGet = Bun.spawn([flutterBin, 'pub', 'get'], {
    cwd: flutterDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await pubGet.exited;

  if (pubGet.exitCode !== 0) {
    const err = await new Response(pubGet.stderr).text();
    console.warn(`flutter pub get warning: ${err}`);
  }

  if (projectRoot) {
    const resolvedDartBin =
      dartBin ?? Bun.which('dart') ?? join(homedir(), '.fsx/flutter/bin/dart');
    try {
      await generateAssets({
        projectRoot,
        flutterDir,
        dartBin: resolvedDartBin,
      });
    } catch (err) {
      console.warn(`[fsx] generateAssets warning: ${err}`);
    }
  }
};

const syncFonts = async (
  projectRoot: string,
  flutterDir: string,
  fonts: FontMap,
): Promise<void> => {
  const destDir = join(flutterDir, '.fsx-fonts');
  mkdirSync(destDir, { recursive: true });

  const hashCachePath = join(flutterDir, '.fsx-font-hashes.json');
  let oldHashes: Record<string, string> = {};
  if (existsSync(hashCachePath)) {
    try {
      oldHashes = JSON.parse(readFileSync(hashCachePath, 'utf-8')) as Record<
        string,
        string
      >;
    } catch {
      oldHashes = {};
    }
  }

  const presentFiles: string[] = [];
  for (const entries of Object.values(fonts)) {
    for (const entry of entries) presentFiles.push(entry.file);
  }

  const newHashes: Record<string, string> = {};
  for (const file of presentFiles) {
    const src = join(projectRoot, 'fonts', file);
    const dest = join(destDir, file);
    const current = await hashFile(src);
    if (current !== oldHashes[file] || !existsSync(dest)) {
      writeFileSync(dest, readFileSync(src));
    }
    newHashes[file] = current;
  }

  writeFileSync(hashCachePath, JSON.stringify(newHashes, null, 2), 'utf-8');
};

export const scaffoldUserProject = async (
  projectDir: string,
  config: {
    name: string;
    bundleId: string;
    target: string;
  },
): Promise<void> => {
  const { appToml } = await import('../templates/app-toml.js');
  const { appTsx } = await import('../templates/app-tsx.js');
  const { userPackageJson } = await import('../templates/user-package-json.js');
  const { userTsconfig } = await import('../templates/user-tsconfig.js');
  const { gitignore } = await import('../templates/gitignore.js');

  const srcDir = join(projectDir, 'src');
  const testDir = join(projectDir, 'tests');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });

  writeFileSync(join(srcDir, 'App.tsx'), appTsx(config.name), 'utf-8');

  writeFileSync(
    join(projectDir, 'app.toml'),
    appToml(config.name, config.bundleId, config.target),
    'utf-8',
  );

  writeFileSync(
    join(projectDir, 'package.json'),
    userPackageJson(config.name),
    'utf-8',
  );

  writeFileSync(join(projectDir, 'tsconfig.json'), userTsconfig(), 'utf-8');

  writeFileSync(join(projectDir, '.gitignore'), gitignore(), 'utf-8');
};
