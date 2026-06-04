import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { applyToAndroidManifest } from '@src/flutter/permissions.js';

const emptyManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.app">
    <application android:label="App">
    </application>
</manifest>
`;

describe('applyToAndroidManifest', () => {
  it('adds <uses-permission> for camera', () => {
    expect(applyToAndroidManifest(emptyManifest, { camera: 'For QR' }))
      .toResemble(`
        <?xml version="1.0" encoding="utf-8"?>
        <manifest xmlns:android="http://schemas.android.com/apk/res/android"
            package="com.example.app">
            <application android:label="App">
            </application>
        <!-- fsx:permissions:begin -->
        <uses-permission android:name="android.permission.CAMERA"/>
        <!-- fsx:permissions:end -->
        </manifest>
      `);
  });

  it('emits multiple permissions alphabetically', () => {
    expect(
      applyToAndroidManifest(emptyManifest, { microphone: 'A', camera: 'B' }),
    ).toResemble(`
        <?xml version="1.0" encoding="utf-8"?>
        <manifest xmlns:android="http://schemas.android.com/apk/res/android"
            package="com.example.app">
            <application android:label="App">
            </application>
        <!-- fsx:permissions:begin -->
        <uses-permission android:name="android.permission.CAMERA"/>
        <uses-permission android:name="android.permission.RECORD_AUDIO"/>
        <!-- fsx:permissions:end -->
        </manifest>
      `);
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
    expect(initial).toResemble(`
      <?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="com.example.app">
          <application android:label="App">
          </application>
      <!-- fsx:permissions:begin -->
      <uses-permission android:name="android.permission.CAMERA"/>
      <uses-permission android:name="android.permission.RECORD_AUDIO"/>
      <!-- fsx:permissions:end -->
      </manifest>
    `);

    expect(applyToAndroidManifest(initial, { camera: 'A' })).toResemble(`
      <?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="com.example.app">
          <application android:label="App">
          </application>
      <!-- fsx:permissions:begin -->
      <uses-permission android:name="android.permission.CAMERA"/>
      <!-- fsx:permissions:end -->
      </manifest>
    `);
  });

  it('location_always adds both FINE and BACKGROUND', () => {
    expect(
      applyToAndroidManifest(emptyManifest, { location_always: 'For maps' }),
    ).toResemble(`
        <?xml version="1.0" encoding="utf-8"?>
        <manifest xmlns:android="http://schemas.android.com/apk/res/android"
            package="com.example.app">
            <application android:label="App">
            </application>
        <!-- fsx:permissions:begin -->
        <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
        <!-- fsx:permissions:end -->
        </manifest>
      `);
  });
});
