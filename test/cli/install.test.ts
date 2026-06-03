import { describe, expect, it } from 'bun:test';

import {
  type ReleaseEntry as Entry,
  selectStableRelease,
} from '@src/flutter/release.js';

const HASH = 'abc123';
const macReleases: Entry[] = [
  // The feed lists x64 first — the bug was picking this on Apple silicon.
  {
    hash: HASH,
    channel: 'stable',
    version: '3.44.0',
    archive: 'stable/macos/flutter_macos_3.44.0-stable.zip',
    dart_sdk_arch: 'x64',
  },
  {
    hash: HASH,
    channel: 'stable',
    version: '3.44.0',
    archive: 'stable/macos/flutter_macos_arm64_3.44.0-stable.zip',
    dart_sdk_arch: 'arm64',
  },
  {
    hash: 'old',
    channel: 'beta',
    version: '3.45.0',
    archive: 'beta/macos/flutter_macos_arm64_3.45.0-beta.zip',
    dart_sdk_arch: 'arm64',
  },
];

describe('selectStableRelease', () => {
  it('picks the arm64 build on Apple silicon (not the first/x64 entry)', () => {
    const r = selectStableRelease(macReleases, HASH, 'arm64');
    expect(r.dart_sdk_arch).toBe('arm64');
    expect(r.archive).toBe('stable/macos/flutter_macos_arm64_3.44.0-stable.zip');
  });

  it('picks the x64 build on Intel', () => {
    const r = selectStableRelease(macReleases, HASH, 'x64');
    expect(r.dart_sdk_arch).toBe('x64');
    expect(r.archive).toBe('stable/macos/flutter_macos_3.44.0-stable.zip');
  });

  it('falls back to an arch-agnostic stable build when no arch matches', () => {
    const legacy: Entry[] = [
      { hash: HASH, channel: 'stable', version: '2.0.0', archive: 'a.zip' },
    ];
    const r = selectStableRelease(legacy, HASH, 'arm64');
    expect(r.archive).toBe('a.zip');
  });

  it('falls back to the first stable entry when neither arch nor agnostic matches', () => {
    const onlyX64: Entry[] = [
      {
        hash: HASH,
        channel: 'stable',
        version: '3.0.0',
        archive: 'x.zip',
        dart_sdk_arch: 'x64',
      },
    ];
    const r = selectStableRelease(onlyX64, HASH, 'arm64');
    expect(r.archive).toBe('x.zip');
  });

  it('throws when there is no stable release for the hash', () => {
    expect(() => selectStableRelease(macReleases, 'nope', 'arm64')).toThrow(
      /Could not find stable/,
    );
  });
});
