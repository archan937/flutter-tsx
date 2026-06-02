import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface DetectedAssets {
  icon?: true;
  splash?: true;
  background?: true;
  monochrome?: true;
  iconDark?: true;
  splashDark?: true;
  backgroundDark?: true;
  monochromeDark?: true;
}

export interface IconSlot {
  key: keyof DetectedAssets;
  relPath: string;
  recommendedSize: number;
}

export const ICON_SLOTS: readonly IconSlot[] = [
  { key: 'icon', relPath: 'icons/icon.png', recommendedSize: 1024 },
  { key: 'splash', relPath: 'icons/splash.png', recommendedSize: 1024 },
  { key: 'background', relPath: 'icons/background.png', recommendedSize: 0 },
  { key: 'monochrome', relPath: 'icons/monochrome.png', recommendedSize: 1024 },
  { key: 'iconDark', relPath: 'icons/dark/icon.png', recommendedSize: 1024 },
  {
    key: 'splashDark',
    relPath: 'icons/dark/splash.png',
    recommendedSize: 1024,
  },
  {
    key: 'backgroundDark',
    relPath: 'icons/dark/background.png',
    recommendedSize: 0,
  },
  {
    key: 'monochromeDark',
    relPath: 'icons/dark/monochrome.png',
    recommendedSize: 1024,
  },
];

// Keys that trigger flutter_launcher_icons when changed
const LAUNCHER_KEYS = new Set<keyof DetectedAssets>([
  'icon',
  'background',
  'monochrome',
  'iconDark',
  'backgroundDark',
  'monochromeDark',
]);

// Keys that trigger flutter_native_splash when changed
const SPLASH_KEYS = new Set<keyof DetectedAssets>([
  'icon',
  'splash',
  'background',
  'splashDark',
  'backgroundDark',
]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Reads a PNG's pixel dimensions from its IHDR chunk. Returns null when the
 * file is not a valid PNG (e.g. a JPEG mistakenly saved as `.png`) — the caller
 * surfaces that as a clear message instead of parsing unrelated bytes as if
 * they were the IHDR width/height (which produced absurd sizes before).
 */
export const readPngDimensions = (
  path: string,
): { width: number; height: number } | null => {
  const buf = readFileSync(path);
  if (
    buf.length < 24 ||
    PNG_SIGNATURE.some((byte, i) => buf[i] !== byte) ||
    buf.toString('latin1', 12, 16) !== 'IHDR'
  ) {
    return null;
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: dv.getUint32(16, false), height: dv.getUint32(20, false) };
};

export const hashFile = async (path: string): Promise<string> => {
  const bytes = await Bun.file(path).bytes();
  return Bun.hash(bytes).toString(16);
};

export const detectAssets = (projectRoot: string): DetectedAssets => {
  const result: DetectedAssets = {};
  for (const slot of ICON_SLOTS) {
    if (existsSync(join(projectRoot, slot.relPath))) {
      result[slot.key] = true;
    }
  }
  return result;
};

interface SpawnResult {
  exited: Promise<number>;
  stderr: unknown;
}

type SpawnFn = (argv: string[], opts?: { cwd?: string }) => SpawnResult;

export interface GenerateAssetsOptions {
  projectRoot: string;
  flutterDir: string;
  dartBin: string;
  spawn?: SpawnFn;
}

const defaultSpawn: SpawnFn = (argv, opts) => {
  const proc = Bun.spawn(argv, {
    cwd: opts?.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exited: proc.exited as Promise<number>, stderr: proc.stderr };
};

export const generateAssets = async ({
  projectRoot,
  flutterDir,
  dartBin,
  spawn = defaultSpawn,
}: GenerateAssetsOptions): Promise<void> => {
  const assets = detectAssets(projectRoot);
  const presentSlots = ICON_SLOTS.filter((s) => assets[s.key]);

  if (presentSlots.length === 0) return;

  // Warn on non-recommended sizes
  for (const slot of presentSlots) {
    if (slot.recommendedSize > 0) {
      const dims = readPngDimensions(join(projectRoot, slot.relPath));
      if (dims === null) {
        logger.warn(
          `${slot.relPath}: not a valid PNG (is it a JPEG saved as .png?) — icon generation may fail`,
        );
      } else if (
        dims.width !== slot.recommendedSize ||
        dims.height !== slot.recommendedSize
      ) {
        logger.warn(
          `${slot.relPath}: expected ${slot.recommendedSize}×${slot.recommendedSize}, got ${dims.width}×${dims.height}`,
        );
      }
    }
  }

  // Copy assets to flutterDir/.fsx-assets/
  mkdirSync(join(flutterDir, '.fsx-assets'), { recursive: true });
  for (const slot of presentSlots) {
    const dest = join(flutterDir, '.fsx-assets', slot.relPath);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, readFileSync(join(projectRoot, slot.relPath)));
  }

  // Read existing hash cache
  const hashCachePath = join(flutterDir, '.fsx-asset-hashes.json');
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

  // Compute current hashes; track which keys changed
  const presentKeys = new Set(presentSlots.map((s) => s.key));
  const newHashes: Record<string, string> = Object.fromEntries(
    Object.entries(oldHashes).filter(([k]) =>
      presentKeys.has(k as keyof DetectedAssets),
    ),
  );
  const changedKeys = new Set<keyof DetectedAssets>();
  for (const slot of presentSlots) {
    const current = await hashFile(join(projectRoot, slot.relPath));
    if (current !== oldHashes[slot.key]) {
      changedKeys.add(slot.key);
    }
    newHashes[slot.key] = current;
  }

  // Determine which engines need to run
  const hasLauncherTrigger = Boolean(assets.icon);
  const hasSplashTrigger = Boolean(assets.splash) || Boolean(assets.icon);

  const launcherFirstRun = hasLauncherTrigger && !oldHashes['icon'];
  const splashFirstRun =
    hasSplashTrigger && !(oldHashes['icon'] ?? oldHashes['splash']);

  const launcherChanged = [...changedKeys].some((k) => LAUNCHER_KEYS.has(k));
  const splashChanged = [...changedKeys].some((k) => SPLASH_KEYS.has(k));

  const shouldRunLauncher =
    hasLauncherTrigger && (launcherChanged || launcherFirstRun);
  const shouldRunSplash = hasSplashTrigger && (splashChanged || splashFirstRun);

  const runEngine = async (args: string[]): Promise<void> => {
    const proc = spawn(args, { cwd: flutterDir });
    const code = await proc.exited;
    if (code !== 0) {
      logger.error(
        `[fsx] Asset generator failed (exit ${code}): ${args.join(' ')}`,
      );
    }
  };

  if (shouldRunLauncher)
    await runEngine([dartBin, 'run', 'flutter_launcher_icons']);
  if (shouldRunSplash)
    await runEngine([dartBin, 'run', 'flutter_native_splash:create']);

  writeFileSync(hashCachePath, JSON.stringify(newHashes, null, 2), 'utf-8');
};
