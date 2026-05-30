import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import * as loggerModule from '@src/cli/utils/logger.js';
import { loadPermissions, PERMISSION_MAP } from '@src/flutter/permissions.js';

const makeTmp = (): string =>
  mkdtempSync(join(tmpdir(), 'fsx-permissions-test-'));

describe('PERMISSION_MAP', () => {
  it('contains all expected permission keys', () => {
    const keys = Object.keys(PERMISSION_MAP).sort();
    expect(keys).toEqual(
      [
        'camera',
        'microphone',
        'location',
        'location_always',
        'photos',
        'contacts',
        'calendar',
        'bluetooth',
        'notifications',
        'face_id',
        'tracking',
      ].sort(),
    );
  });

  it('has correct ios keys for camera', () => {
    expect(PERMISSION_MAP['camera'].ios).toEqual(['NSCameraUsageDescription']);
    expect(PERMISSION_MAP['camera'].android).toEqual([
      'android.permission.CAMERA',
    ]);
  });

  it('has correct location_always mapping', () => {
    expect(PERMISSION_MAP['location_always'].ios).toContain(
      'NSLocationAlwaysUsageDescription',
    );
    expect(PERMISSION_MAP['location_always'].android).toContain(
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    );
  });

  it('marks tracking as privacy-manifest type', () => {
    expect(PERMISSION_MAP['tracking'].privacy).toBe(true);
  });
});

describe('loadPermissions', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns {} when permissions.toml missing', () => {
    expect(loadPermissions(tmp)).toEqual({});
  });

  it('returns {} for empty file', () => {
    writeFileSync(join(tmp, 'permissions.toml'), '');
    expect(loadPermissions(tmp)).toEqual({});
  });

  it('loads a single permission', () => {
    writeFileSync(
      join(tmp, 'permissions.toml'),
      'camera = "We use your camera to scan QR codes"\n',
    );
    expect(loadPermissions(tmp)).toEqual({
      camera: 'We use your camera to scan QR codes',
    });
  });

  it('loads all known keys when present', () => {
    const toml = Object.keys(PERMISSION_MAP)
      .map((k) => `${k} = "usage for ${k}"`)
      .join('\n');
    writeFileSync(join(tmp, 'permissions.toml'), toml + '\n');
    const perms = loadPermissions(tmp);
    for (const key of Object.keys(PERMISSION_MAP)) {
      expect(perms[key]).toBe(`usage for ${key}`);
    }
  });

  it('warns on unknown key but keeps the rest', () => {
    const toml = ['camera = "QR scanning"', 'flux = "magnetic flux"'].join(
      '\n',
    );
    writeFileSync(join(tmp, 'permissions.toml'), toml + '\n');
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const perms = loadPermissions(tmp);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('flux');
    expect(perms['camera']).toBe('QR scanning');
    expect(perms['flux']).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('logs error and drops a key with empty value', () => {
    writeFileSync(join(tmp, 'permissions.toml'), 'camera = ""\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const perms = loadPermissions(tmp);
    expect(errorSpy).toHaveBeenCalled();
    expect(perms['camera']).toBeUndefined();
    errorSpy.mockRestore();
  });
});
