import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import * as loggerModule from '@src/cli/utils/logger.js';
import { detectPush } from '@src/flutter/push.js';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-push-test-'));

const validFirebaseJson = (): string =>
  JSON.stringify({
    project_info: { project_id: 'demo' },
    client: [{ client_info: { mobilesdk_app_id: 'app' } }],
  });

describe('detectPush', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns false flags when push/ missing', () => {
    expect(detectPush(tmp)).toEqual({ firebase: false, apns: false });
  });

  it('detects firebase.json but no APNs', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(join(tmp, 'push', 'firebase.json'), validFirebaseJson());
    expect(detectPush(tmp)).toEqual({ firebase: true, apns: false });
  });

  it('detects both firebase + APNs', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(join(tmp, 'push', 'firebase.json'), validFirebaseJson());
    writeFileSync(join(tmp, 'push', 'APNs.p8'), 'apns-binary-content');
    expect(detectPush(tmp)).toEqual({ firebase: true, apns: true });
  });

  it('logs error and sets firebase false on malformed firebase.json', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(join(tmp, 'push', 'firebase.json'), '{ not json }');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectPush(tmp).firebase).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error when firebase.json is a JSON array', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(join(tmp, 'push', 'firebase.json'), '[]');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectPush(tmp).firebase).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error when client field is not an array', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(
      join(tmp, 'push', 'firebase.json'),
      JSON.stringify({ project_info: { project_id: 'x' }, client: 'oops' }),
    );
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectPush(tmp).firebase).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error and sets firebase false on missing required fields', () => {
    mkdirSync(join(tmp, 'push'));
    writeFileSync(
      join(tmp, 'push', 'firebase.json'),
      JSON.stringify({ project_info: {} }),
    );
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectPush(tmp).firebase).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
