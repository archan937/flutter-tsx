import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import {
  applyLinksToEntitlements,
  applyLinksToInfoPlist,
} from '@src/flutter/links.js';

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
    expect(applyLinksToInfoPlist(emptyPlist, { scheme: 'myapp', domains: [] }))
      .toResemble(`
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        <key>CFBundleName</key>
        <string>MyApp</string>
        <!-- fsx:links:begin -->
        <key>CFBundleURLTypes</key>
        <array>
        <dict>
        <key>CFBundleURLSchemes</key>
        <array>
        <string>myapp</string>
        </array>
        </dict>
        </array>
        <!-- fsx:links:end -->
        </dict>
        </plist>
      `);
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
    expect(applyLinksToEntitlements(emptyEntitlements, {
      scheme: null,
      domains: ['myapp.com'],
    })).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:links:begin -->
      <key>com.apple.developer.associated-domains</key>
      <array>
      <string>applinks:myapp.com</string>
      </array>
      <!-- fsx:links:end -->
      </dict>
      </plist>
    `);
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
    expect(initial).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:links:begin -->
      <key>com.apple.developer.associated-domains</key>
      <array>
      <string>applinks:myapp.com</string>
      <string>applinks:staging.myapp.com</string>
      </array>
      <!-- fsx:links:end -->
      </dict>
      </plist>
    `);

    expect(applyLinksToEntitlements(initial, {
      scheme: null,
      domains: ['myapp.com'],
    })).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:links:begin -->
      <key>com.apple.developer.associated-domains</key>
      <array>
      <string>applinks:myapp.com</string>
      </array>
      <!-- fsx:links:end -->
      </dict>
      </plist>
    `);
  });
});
