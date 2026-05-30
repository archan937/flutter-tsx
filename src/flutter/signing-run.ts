import { logger } from '../cli/utils/logger.js';
import type { MacosSigning, WindowsSigning } from '../config.js';
import {
  absPath,
  codesignArgs,
  notarytoolArgs,
  signtoolArgs,
} from './signing.js';

/**
 * Post-build signing runners. Spawn external toolchains (codesign / notarytool /
 * signtool), so this module is integration-only — kept separate from the pure,
 * unit-tested arg builders in `signing.ts` and imported only by `fsx build`.
 */

const spawnSign = async (args: string[], cwd: string): Promise<boolean> => {
  const proc = Bun.spawn(args, { cwd, stdout: 'inherit', stderr: 'inherit' });
  return ((await proc.exited) ?? 0) === 0;
};

const firstMatch = (cwd: string, pattern: string): string | null => {
  const matches = [
    ...new Bun.Glob(pattern).scanSync({ cwd, onlyFiles: false }),
  ];
  return matches.length > 0 ? `${cwd}/${matches[0]}` : null;
};

/** Developer ID-sign the built macOS .app, then optionally notarize + staple. */
export const signMacosApp = async (
  flutterDir: string,
  signing: MacosSigning,
): Promise<void> => {
  const appPath = firstMatch(
    flutterDir,
    'build/macos/Build/Products/Release/*.app',
  );
  if (!appPath) {
    logger.warn('macOS signing: no built .app found, skipped.');
    return;
  }
  if (!(await spawnSign(codesignArgs(signing.identity, appPath), flutterDir))) {
    logger.warn('macOS codesign failed.');
    return;
  }
  if (signing.notarize) {
    const { appleIdEnv, passwordEnv, teamId } = signing.notarize;
    const appleId = appleIdEnv ? (process.env[appleIdEnv] ?? '') : '';
    const password = passwordEnv ? (process.env[passwordEnv] ?? '') : '';
    await spawnSign(
      notarytoolArgs(appPath, { appleId, password, teamId }),
      flutterDir,
    );
    await spawnSign(['xcrun', 'stapler', 'staple', appPath], flutterDir);
  }
};

/** Authenticode-sign the built Windows executable. */
export const signWindowsArtifact = async (
  root: string,
  flutterDir: string,
  signing: WindowsSigning,
): Promise<void> => {
  const exe = firstMatch(flutterDir, 'build/windows/**/runner/Release/*.exe');
  if (!exe) {
    logger.warn('Windows signing: no built .exe found, skipped.');
    return;
  }
  const passwordEnvValue = signing.passwordEnv
    ? (process.env[signing.passwordEnv] ?? '')
    : undefined;
  await spawnSign(
    signtoolArgs(exe, {
      certificate: absPath(root, signing.certificate),
      passwordEnvValue,
    }),
    flutterDir,
  );
};
