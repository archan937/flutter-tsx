import {
  applyLinksToEntitlements,
  applyLinksToInfoPlist,
} from '@src/flutter/links.js';
import { describe, expect, it } from 'bun:test';

const emptyPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>MyApp</string>
</dict>
</plist>
`;

const emptyEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;

describe('applyLinksToInfoPlist', () => {
  it('adds CFBundleURLTypes for scheme', () => {
    const out = applyLinksToInfoPlist(emptyPlist, {
      scheme: 'myapp',
      domains: [],
    });
    expect(out).toContain('CFBundleURLTypes');
    expect(out).toContain('myapp');
    expect(out).toContain('<key>CFBundleName</key>');
  });

  it('is idempotent', () => {
    const first = applyLinksToInfoPlist(emptyPlist, {
      scheme: 'myapp',
      domains: [],
    });
    const second = applyLinksToInfoPlist(first, {
      scheme: 'myapp',
      domains: [],
    });
    expect(second).toBe(first);
  });
});

describe('applyLinksToEntitlements', () => {
  it('adds applinks entry for domain', () => {
    const out = applyLinksToEntitlements(emptyEntitlements, {
      scheme: null,
      domains: ['myapp.com'],
    });
    expect(out).toContain('com.apple.developer.associated-domains');
    expect(out).toContain('applinks:myapp.com');
  });

  it('is idempotent', () => {
    const first = applyLinksToEntitlements(emptyEntitlements, {
      scheme: null,
      domains: ['myapp.com'],
    });
    const second = applyLinksToEntitlements(first, {
      scheme: null,
      domains: ['myapp.com'],
    });
    expect(second).toBe(first);
  });

  it('drops stale domain on re-apply', () => {
    const initial = applyLinksToEntitlements(emptyEntitlements, {
      scheme: null,
      domains: ['myapp.com', 'staging.myapp.com'],
    });
    expect(initial).toContain('staging.myapp.com');
    const after = applyLinksToEntitlements(initial, {
      scheme: null,
      domains: ['myapp.com'],
    });
    expect(after).toContain('myapp.com');
    expect(after).not.toContain('staging.myapp.com');
  });
});
