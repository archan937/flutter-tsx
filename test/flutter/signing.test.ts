import * as loggerModule from '@src/cli/utils/logger.js';
import { detectSigning } from '@src/flutter/signing.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-signing-test-'));

describe('detectSigning', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns false flags when signing/ missing', () => {
    expect(detectSigning(tmp)).toEqual({ android: false, ios: false });
  });

  it('detects android when keystore + properties both present', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(join(tmp, 'signing', 'release.keystore'), 'fake-binary');
    writeFileSync(
      join(tmp, 'signing', 'android.properties'),
      'storePassword=secret\nkeyPassword=secret\nkeyAlias=upload\nstoreFile=release.keystore\n',
    );
    expect(detectSigning(tmp)).toEqual({ android: true, ios: false });
  });

  it('logs error when android keystore is present but properties is missing', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(join(tmp, 'signing', 'release.keystore'), 'fake-binary');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectSigning(tmp)).toEqual({ android: false, ios: false });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('detects iOS when .p12 + .mobileprovision both present', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(join(tmp, 'signing', 'cert.p12'), 'fake-binary');
    writeFileSync(join(tmp, 'signing', 'profile.mobileprovision'), 'fake');
    expect(detectSigning(tmp)).toEqual({ android: false, ios: true });
  });

  it('logs error when android.properties present but keystore missing', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(
      join(tmp, 'signing', 'android.properties'),
      'storePassword=secret\n',
    );
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectSigning(tmp)).toEqual({ android: false, ios: false });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error when iOS mobileprovision present but .p12 missing', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(join(tmp, 'signing', 'profile.mobileprovision'), 'fake');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectSigning(tmp)).toEqual({ android: false, ios: false });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error when iOS .p12 present but mobileprovision missing', () => {
    mkdirSync(join(tmp, 'signing'));
    writeFileSync(join(tmp, 'signing', 'cert.p12'), 'fake-binary');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectSigning(tmp)).toEqual({ android: false, ios: false });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
