import { describe, expect, it } from 'bun:test';

import { buildBuildArgs, SUPPORTED_BUILD_TARGETS } from '@src/flutter/build.js';

describe('buildBuildArgs', () => {
  it('builds web', () => {
    expect(buildBuildArgs('flutter', 'web')).toEqual([
      'flutter',
      'build',
      'web',
    ]);
  });

  it('builds iOS without code signing (CI-safe)', () => {
    expect(buildBuildArgs('flutter', 'ios')).toEqual([
      'flutter',
      'build',
      'ios',
      '--no-codesign',
    ]);
  });

  it('builds android as an apk', () => {
    expect(buildBuildArgs('flutter', 'android')).toEqual([
      'flutter',
      'build',
      'apk',
    ]);
  });

  it('builds the three desktop targets', () => {
    expect(buildBuildArgs('flutter', 'macos')).toEqual([
      'flutter',
      'build',
      'macos',
    ]);
    expect(buildBuildArgs('flutter', 'windows')).toEqual([
      'flutter',
      'build',
      'windows',
    ]);
    expect(buildBuildArgs('flutter', 'linux')).toEqual([
      'flutter',
      'build',
      'linux',
    ]);
  });

  it('honors a custom flutter binary path', () => {
    expect(buildBuildArgs('/opt/flutter/bin/flutter', 'web')[0]).toBe(
      '/opt/flutter/bin/flutter',
    );
  });

  it('appends --dart-define flags after the sub-command', () => {
    expect(
      buildBuildArgs('flutter', 'web', ['--dart-define=API=https://x']),
    ).toEqual(['flutter', 'build', 'web', '--dart-define=API=https://x']);
  });

  it('throws on an unknown target, listing the supported ones', () => {
    expect(() => buildBuildArgs('flutter', 'fuchsia')).toThrow(
      /Unknown build target 'fuchsia'/,
    );
    expect(() => buildBuildArgs('flutter', 'fuchsia')).toThrow(/web/);
  });

  it('SUPPORTED_BUILD_TARGETS covers the six platforms', () => {
    expect([...SUPPORTED_BUILD_TARGETS].sort()).toEqual([
      'android',
      'ios',
      'linux',
      'macos',
      'web',
      'windows',
    ]);
  });
});
