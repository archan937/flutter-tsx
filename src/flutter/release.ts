export interface ReleaseEntry {
  hash: string;
  channel: string;
  version: string;
  archive: string;
  /** "arm64" | "x64" — present on modern releases; absent on old ones. */
  dart_sdk_arch?: string;
}

/**
 * The Flutter releases feed lists multiple SDKs for the current stable hash —
 * one per CPU arch (e.g. macOS ships both an x64 and an arm64 build). Picking
 * the first match grabs x64 even on Apple silicon, which makes the whole Flutter
 * toolchain run under Rosetta: macOS builds then fail with an "Unable to find a
 * device matching arch:arm64" mismatch (Flutter detects the arm64 host yet the
 * Rosetta xcodebuild can only produce x86_64). Select the build whose
 * `dart_sdk_arch` matches the host CPU.
 */
export const selectStableRelease = (
  releases: ReleaseEntry[],
  stableHash: string,
  hostArch: string,
): ReleaseEntry => {
  const stable = releases.filter(
    (r) => r.hash === stableHash && r.channel === 'stable',
  );
  if (stable.length === 0)
    throw new Error('Could not find stable Flutter release');
  const archMatch = stable.find((r) => r.dart_sdk_arch === hostArch);
  // Fall back to an arch-agnostic build (old releases), then to whatever's first.
  return archMatch ?? stable.find((r) => !r.dart_sdk_arch) ?? stable[0];
};
