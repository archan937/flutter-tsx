import { describe, expect, it } from 'bun:test';

import { FlutterRunner } from '@src/flutter/runner.js';

describe('FlutterRunner.buildRunArgs', () => {
  it('maps web → chrome device', () => {
    const args = FlutterRunner.buildRunArgs('flutter', 'web', []);
    expect(args).toEqual(['flutter', 'run', '-d', 'chrome']);
  });

  it('passes an unknown target through as the device id', () => {
    const args = FlutterRunner.buildRunArgs('flutter', 'ios', []);
    expect(args).toEqual(['flutter', 'run', '-d', 'ios']);
  });

  it('appends --dart-define flags after the device', () => {
    const args = FlutterRunner.buildRunArgs('flutter', 'web', [
      '--dart-define=API_URL=https://x',
      '--dart-define=FLAG=on',
    ]);
    expect(args).toEqual([
      'flutter',
      'run',
      '-d',
      'chrome',
      '--dart-define=API_URL=https://x',
      '--dart-define=FLAG=on',
    ]);
  });
});
