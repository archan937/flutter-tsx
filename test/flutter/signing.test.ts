import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  androidKeyProperties,
  codesignArgs,
  notarytoolArgs,
  prepareAndroidSigning,
  prepareIosSigning,
  signtoolArgs,
} from '@src/flutter/signing.js';

describe('androidKeyProperties', () => {
  it('renders the gradle key.properties fields', () => {
    const props = androidKeyProperties({
      storeFile: '/abs/signing/android/release.jks',
      keyAlias: 'app',
      storePassword: 's3cret',
      keyPassword: 's3cret',
    });
    expect(props).toContain('storeFile=/abs/signing/android/release.jks');
    expect(props).toContain('keyAlias=app');
    expect(props).toContain('storePassword=s3cret');
    expect(props).toContain('keyPassword=s3cret');
  });
});

describe('codesignArgs', () => {
  it('Developer ID-signs the .app with hardened runtime', () => {
    const args = codesignArgs(
      'Developer ID Application: Acme',
      '/build/My.app',
    );
    expect(args[0]).toBe('codesign');
    expect(args).toContain('--sign');
    expect(args[args.indexOf('--sign') + 1]).toBe(
      'Developer ID Application: Acme',
    );
    expect(args).toContain('runtime'); // --options runtime
    expect(args[args.length - 1]).toBe('/build/My.app');
  });

  it('includes entitlements when provided', () => {
    const args = codesignArgs('id', '/build/My.app', '/path/app.entitlements');
    expect(args).toContain('--entitlements');
    expect(args[args.indexOf('--entitlements') + 1]).toBe(
      '/path/app.entitlements',
    );
  });
});

describe('notarytoolArgs', () => {
  it('submits and waits with apple-id/password/team-id', () => {
    const args = notarytoolArgs('/build/My.zip', {
      appleId: 'me@example.com',
      password: 'app-pw',
      teamId: 'TEAM123',
    });
    expect(args.slice(0, 3)).toEqual(['xcrun', 'notarytool', 'submit']);
    expect(args).toContain('--wait');
    expect(args[args.indexOf('--team-id') + 1]).toBe('TEAM123');
    expect(args[args.indexOf('--apple-id') + 1]).toBe('me@example.com');
  });
});

describe('signtoolArgs', () => {
  it('signs with the .pfx and a SHA256 timestamp', () => {
    const args = signtoolArgs('/build/app.exe', {
      certificate: 'C:/signing/windows/cert.pfx',
      passwordEnvValue: 'pw',
    });
    expect(args.slice(0, 2)).toEqual(['signtool', 'sign']);
    expect(args[args.indexOf('/f') + 1]).toBe('C:/signing/windows/cert.pfx');
    expect(args[args.indexOf('/p') + 1]).toBe('pw');
    expect(args).toContain('/tr'); // timestamp server
    expect(args[args.length - 1]).toBe('/build/app.exe');
  });

  it('omits /p when no password is given', () => {
    const args = signtoolArgs('/build/app.exe', {
      certificate: 'cert.pfx',
    });
    expect(args).not.toContain('/p');
  });
});

describe('prepareAndroidSigning', () => {
  it('writes android/key.properties with env-sourced passwords + absolute keystore', () => {
    const root = mkdtempSync(join(tmpdir(), 'fsx-sign-'));
    writeFileSync(join(root, 'release.jks'), 'KEYSTORE');
    mkdirSync(join(root, 'flutter', 'android'), { recursive: true });
    process.env.TEST_STORE_PW = 's3cret';
    prepareAndroidSigning(root, join(root, 'flutter'), {
      signing: {
        keystore: 'release.jks',
        keyAlias: 'app',
        storePasswordEnv: 'TEST_STORE_PW',
      },
    });
    delete process.env.TEST_STORE_PW;
    const props = readFileSync(
      join(root, 'flutter', 'android', 'key.properties'),
      'utf-8',
    );
    expect(props).toContain('keyAlias=app');
    expect(props).toContain('storePassword=s3cret');
    expect(props).toContain(join(root, 'release.jks'));
  });

  it('copies the Android FCM config into place', () => {
    const root = mkdtempSync(join(tmpdir(), 'fsx-sign-'));
    writeFileSync(join(root, 'google-services.json'), '{}');
    mkdirSync(join(root, 'flutter', 'android', 'app'), { recursive: true });
    prepareAndroidSigning(root, join(root, 'flutter'), {
      firebase: 'google-services.json',
    });
    expect(
      readFileSync(
        join(root, 'flutter', 'android', 'app', 'google-services.json'),
        'utf-8',
      ),
    ).toBe('{}');
  });
});

describe('prepareIosSigning', () => {
  it('copies the iOS FCM config into place', () => {
    const root = mkdtempSync(join(tmpdir(), 'fsx-sign-'));
    writeFileSync(join(root, 'GoogleService-Info.plist'), '<plist/>');
    mkdirSync(join(root, 'flutter', 'ios', 'Runner'), { recursive: true });
    prepareIosSigning(root, join(root, 'flutter'), {
      firebase: 'GoogleService-Info.plist',
    });
    expect(
      readFileSync(
        join(root, 'flutter', 'ios', 'Runner', 'GoogleService-Info.plist'),
        'utf-8',
      ),
    ).toBe('<plist/>');
  });
});
