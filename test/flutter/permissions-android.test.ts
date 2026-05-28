import { applyToAndroidManifest } from '@src/flutter/permissions.js';
import { describe, expect, it } from 'bun:test';

const emptyManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.app">
    <application android:label="App">
    </application>
</manifest>
`;

describe('applyToAndroidManifest', () => {
  it('adds <uses-permission> for camera', () => {
    const out = applyToAndroidManifest(emptyManifest, { camera: 'For QR' });
    expect(out).toContain(
      '<uses-permission android:name="android.permission.CAMERA"/>',
    );
  });

  it('emits multiple permissions alphabetically', () => {
    const out = applyToAndroidManifest(emptyManifest, {
      microphone: 'A',
      camera: 'B',
    });
    const cameraIdx = out.indexOf('android.permission.CAMERA');
    const recordIdx = out.indexOf('android.permission.RECORD_AUDIO');
    expect(cameraIdx).toBeGreaterThan(-1);
    expect(recordIdx).toBeGreaterThan(cameraIdx);
  });

  it('is idempotent', () => {
    const first = applyToAndroidManifest(emptyManifest, { camera: 'For QR' });
    const second = applyToAndroidManifest(first, { camera: 'For QR' });
    expect(second).toBe(first);
  });

  it('drops a stale permission when re-applied', () => {
    const initial = applyToAndroidManifest(emptyManifest, {
      camera: 'A',
      microphone: 'B',
    });
    expect(initial).toContain('android.permission.CAMERA');
    expect(initial).toContain('android.permission.RECORD_AUDIO');
    const after = applyToAndroidManifest(initial, { camera: 'A' });
    expect(after).toContain('android.permission.CAMERA');
    expect(after).not.toContain('android.permission.RECORD_AUDIO');
  });

  it('location_always adds both FINE and BACKGROUND', () => {
    const out = applyToAndroidManifest(emptyManifest, {
      location_always: 'For maps',
    });
    expect(out).toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(out).toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
  });
});
