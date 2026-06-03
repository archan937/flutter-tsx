import '../helpers/resemble.js';

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
    expect(
      androidKeyProperties({
        storeFile: '/abs/signing/android/release.jks',
        keyAlias: 'app',
        storePassword: 's3cret',
        keyPassword: 's3cret',
      }),
    ).toResemble(`
      storeFile=/abs/signing/android/release.jks
      keyAlias=app
      storePassword=s3cret
      keyPassword=s3cret
    `);
  });
});

describe('codesignArgs', () => {
  it('Developer ID-signs the .app with hardened runtime', () => {
    expect(
      codesignArgs('Developer ID Application: Acme', '/build/My.app'),
    ).toEqual([
      'codesign',
      '--force',
      '--deep',
      '--options',
      'runtime',
      '--sign',
      'Developer ID Application: Acme',
      '/build/My.app',
    ]);
  });

  it('includes entitlements when provided', () => {
    expect(
      codesignArgs('id', '/build/My.app', '/path/app.entitlements'),
    ).toEqual([
      'codesign',
      '--force',
      '--deep',
      '--options',
      'runtime',
      '--sign',
      'id',
      '--entitlements',
      '/path/app.entitlements',
      '/build/My.app',
    ]);
  });
});

describe('notarytoolArgs', () => {
  it('submits and waits with apple-id/password/team-id', () => {
    expect(
      notarytoolArgs('/build/My.zip', {
        appleId: 'me@example.com',
        password: 'app-pw',
        teamId: 'TEAM123',
      }),
    ).toEqual([
      'xcrun',
      'notarytool',
      'submit',
      '/build/My.zip',
      '--apple-id',
      'me@example.com',
      '--password',
      'app-pw',
      '--team-id',
      'TEAM123',
      '--wait',
    ]);
  });
});

describe('signtoolArgs', () => {
  it('signs with the .pfx and a SHA256 timestamp', () => {
    expect(
      signtoolArgs('/build/app.exe', {
        certificate: 'C:/signing/windows/cert.pfx',
        passwordEnvValue: 'pw',
      }),
    ).toEqual([
      'signtool',
      'sign',
      '/fd',
      'SHA256',
      '/f',
      'C:/signing/windows/cert.pfx',
      '/p',
      'pw',
      '/tr',
      'http://timestamp.digicert.com',
      '/td',
      'SHA256',
      '/build/app.exe',
    ]);
  });

  it('omits /p when no password is given', () => {
    expect(signtoolArgs('/build/app.exe', { certificate: 'cert.pfx' })).toEqual([
      'signtool',
      'sign',
      '/fd',
      'SHA256',
      '/f',
      'cert.pfx',
      '/tr',
      'http://timestamp.digicert.com',
      '/td',
      'SHA256',
      '/build/app.exe',
    ]);
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
    expect(props).toResemble(`
      storeFile=${join(root, 'release.jks')}
      keyAlias=app
      storePassword=s3cret
      keyPassword=s3cret
    `);
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
