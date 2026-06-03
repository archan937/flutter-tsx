import { describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { FlutterRunner } from '@src/flutter/runner.js';

/**
 * Writes a fake `flutter` executable that prints a stdout line + a stderr noise
 * line (to exercise pipeOutput + the XCODE_NOISE filter), then echoes each
 * stdin line to `echoFile` and exits when it receives `q`.
 */
const makeFakeFlutter = (): { bin: string; echoFile: string; dir: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'fsx-runner-'));
  const echoFile = join(dir, 'stdin-echo.txt');
  const bin = join(dir, 'flutter');
  writeFileSync(
    bin,
    `#!/bin/sh
echo "Launching lib/main.dart on Chrome"
echo "DVTBuildVersion noise line" >&2
while IFS= read -r line; do
  printf '%s\\n' "$line" >> "${echoFile}"
  [ "$line" = "q" ] && exit 0
done
`,
    { mode: 0o755 },
  );
  chmodSync(bin, 0o755);
  return { bin, echoFile, dir };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

describe('FlutterRunner.buildRunArgs', () => {
  it('maps web → chrome device', () => {
    expect(FlutterRunner.buildRunArgs('flutter', 'web', [])).toEqual([
      'flutter',
      'run',
      '-d',
      'chrome',
    ]);
  });

  it('passes an unknown target through as the device id', () => {
    expect(FlutterRunner.buildRunArgs('flutter', 'ios', [])).toEqual([
      'flutter',
      'run',
      '-d',
      'ios',
    ]);
  });

  it('appends --dart-define flags after the device', () => {
    expect(
      FlutterRunner.buildRunArgs('flutter', 'web', [
        '--dart-define=A=1',
        '--dart-define=B=2',
      ]),
    ).toEqual([
      'flutter',
      'run',
      '-d',
      'chrome',
      '--dart-define=A=1',
      '--dart-define=B=2',
    ]);
  });
});

describe('FlutterRunner lifecycle', () => {
  it('starts, hot-reloads/restarts via stdin, and stops', async () => {
    const { bin, echoFile, dir } = makeFakeFlutter();
    const runner = new FlutterRunner(dir, { target: 'web', flutterBin: bin });

    await runner.start();
    expect(runner.isRunning).toBe(true);

    await runner.hotReload();
    await runner.hotRestart();
    await sleep(150);

    await runner.stop();
    expect(runner.isRunning).toBe(false);

    const echoed = readFileSync(echoFile, 'utf-8');
    expect(echoed.trim().split('\n')).toEqual(['r', 'R', 'q']);
  });

  it('throws if start() is called twice', async () => {
    const { bin, dir } = makeFakeFlutter();
    const runner = new FlutterRunner(dir, { target: 'web', flutterBin: bin });
    await runner.start();
    try {
      await expect(runner.start()).rejects.toThrow(/already started/);
    } finally {
      await runner.stop();
    }
  });

  it('hotReload/hotRestart/stop are no-ops before start', async () => {
    const runner = new FlutterRunner('/tmp', { target: 'web' });
    expect(runner.isRunning).toBe(false);
    await runner.hotReload();
    await runner.hotRestart();
    await runner.stop();
    expect(runner.isRunning).toBe(false);
  });
});
