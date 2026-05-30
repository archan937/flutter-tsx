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
    const out = applyLinksToAndroidManifest(baseManifest, {
      scheme: 'myapp',
      domains: [],
    });
    expect(out).toContain('<intent-filter');
    expect(out).toContain('android.intent.action.VIEW');
    expect(out).toContain('android.intent.category.DEFAULT');
    expect(out).toContain('android.intent.category.BROWSABLE');
    expect(out).toContain('android:scheme="myapp"');
  });

  it('adds autoVerify intent-filter for domain', () => {
    const out = applyLinksToAndroidManifest(baseManifest, {
      scheme: null,
      domains: ['myapp.com'],
    });
    expect(out).toContain('android:autoVerify="true"');
    expect(out).toContain('android:scheme="https"');
    expect(out).toContain('android:host="myapp.com"');
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
