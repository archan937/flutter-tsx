import { describe, expect, it } from 'bun:test';

import {
  defaultPermissionDescription,
  HOOK_PERMISSIONS,
  PERMISSION_MAP,
} from '@src/flutter/permissions.js';

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
    expect(PERMISSION_MAP['location_always'].ios).toEqual([
      'NSLocationAlwaysUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
    ]);
    expect(PERMISSION_MAP['location_always'].android).toEqual([
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ]);
  });

  it('marks tracking as privacy-manifest type', () => {
    expect(PERMISSION_MAP['tracking'].privacy).toBe(true);
  });
});

describe('HOOK_PERMISSIONS', () => {
  it('maps useCamera to the camera capability', () => {
    expect(HOOK_PERMISSIONS['useCamera']).toEqual(['camera']);
  });

  it('maps useImagePicker to photos + camera', () => {
    expect(HOOK_PERMISSIONS['useImagePicker']).toEqual(['photos', 'camera']);
  });

  it('only references capabilities that exist in PERMISSION_MAP', () => {
    for (const caps of Object.values(HOOK_PERMISSIONS)) {
      for (const cap of caps) {
        expect(PERMISSION_MAP[cap]).toBeDefined();
      }
    }
  });
});

describe('defaultPermissionDescription', () => {
  it('returns a capability-specific default', () => {
    expect(defaultPermissionDescription('camera')).toBe(
      'This app uses the camera.',
    );
  });

  it('falls back to a generic message for unknown capabilities', () => {
    expect(defaultPermissionDescription('unknown')).toBeTruthy();
  });
});
