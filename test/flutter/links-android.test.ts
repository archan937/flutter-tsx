import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { applyLinksToAndroidManifest } from '@src/flutter/links.js';

const baseManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.app">
    <application android:label="App">
        <activity android:name=".MainActivity">
        </activity>
    </application>
</manifest>
`;

describe('applyLinksToAndroidManifest', () => {
  it('adds an intent-filter for scheme', () => {
    expect(
      applyLinksToAndroidManifest(baseManifest, {
        scheme: 'myapp',
        domains: [],
      }),
    ).toResemble(`
      <?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="com.example.app">
          <application android:label="App">
              <activity android:name=".MainActivity">
      <!-- fsx:links:begin -->
      <intent-filter>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="myapp"/>
      </intent-filter>
      <!-- fsx:links:end -->
              </activity>
          </application>
      </manifest>
    `);
  });

  it('adds autoVerify intent-filter for domain', () => {
    expect(
      applyLinksToAndroidManifest(baseManifest, {
        scheme: null,
        domains: ['myapp.com'],
      }),
    ).toResemble(`
      <?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="com.example.app">
          <application android:label="App">
              <activity android:name=".MainActivity">
      <!-- fsx:links:begin -->
      <intent-filter android:autoVerify="true">
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https" android:host="myapp.com"/>
      </intent-filter>
      <!-- fsx:links:end -->
              </activity>
          </application>
      </manifest>
    `);
  });

  it('is idempotent', () => {
    const first = applyLinksToAndroidManifest(baseManifest, {
      scheme: 'myapp',
      domains: ['myapp.com'],
    });
    const second = applyLinksToAndroidManifest(first, {
      scheme: 'myapp',
      domains: ['myapp.com'],
    });
    expect(second).toBe(first);
  });
});
