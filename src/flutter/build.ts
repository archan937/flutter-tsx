/**
 * Maps an fsx target to the `flutter build` sub-command that produces its
 * release artifact. Kept separate from FlutterRunner (`flutter run`) because a
 * build is non-interactive and exits — the path CI and shipping use.
 */
const BUILD_SUBCOMMANDS: Record<string, string[]> = {
  web: ['web'],
  ios: ['ios', '--no-codesign'],
  android: ['apk'],
  macos: ['macos'],
  windows: ['windows'],
  linux: ['linux'],
};

export const SUPPORTED_BUILD_TARGETS: string[] = Object.keys(BUILD_SUBCOMMANDS);

/** Assembles the `flutter build` argv (pure — exposed for testing). */
export const buildBuildArgs = (
  flutterBin: string,
  target: string,
  dartDefines: string[] = [],
): string[] => {
  const sub = BUILD_SUBCOMMANDS[target];
  if (!sub) {
    throw new Error(
      `[fsx] Unknown build target '${target}'. Expected one of: ${SUPPORTED_BUILD_TARGETS.join(', ')}.`,
    );
  }
  return [flutterBin, 'build', ...sub, ...dartDefines];
};
