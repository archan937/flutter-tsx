import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import {
  applyToMacosEntitlements,
  MACOS_ENTITLEMENT_MAP,
} from '@src/flutter/permissions.js';

const BASE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.app-sandbox</key>
	<true/>
</dict>
</plist>
`;

const withCamera = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>com.apple.security.app-sandbox</key>
<true/>
<!-- fsx:entitlements:begin -->
<key>com.apple.security.device.camera</key>
<true/>
<!-- fsx:entitlements:end -->
</dict>
</plist>`;

describe('MACOS_ENTITLEMENT_MAP', () => {
  it('maps core capabilities to com.apple.security.* entitlements', () => {
    expect(MACOS_ENTITLEMENT_MAP.camera).toEqual([
      'com.apple.security.device.camera',
    ]);
    expect(MACOS_ENTITLEMENT_MAP.microphone).toEqual([
      'com.apple.security.device.audio-input',
    ]);
    expect(MACOS_ENTITLEMENT_MAP.location).toEqual([
      'com.apple.security.personal-information.location',
    ]);
  });
});

describe('applyToMacosEntitlements', () => {
  it('adds a boolean entitlement for an inferred capability', () => {
    expect(applyToMacosEntitlements(BASE, ['camera'])).toResemble(withCamera);
  });

  it('preserves the existing app-sandbox entitlement', () => {
    expect(applyToMacosEntitlements(BASE, ['camera'])).toResemble(withCamera);
  });

  it('is idempotent — applying twice equals once', () => {
    const once = applyToMacosEntitlements(BASE, ['camera', 'microphone']);
    const twice = applyToMacosEntitlements(once, ['camera', 'microphone']);
    expect(twice).toBe(once);
  });

  it('returns the input unchanged when no capabilities map to entitlements', () => {
    expect(applyToMacosEntitlements(BASE, [])).toBe(BASE);
    expect(applyToMacosEntitlements(BASE, ['notifications'])).toBe(BASE);
  });

  it('ignores unknown capabilities', () => {
    expect(applyToMacosEntitlements(BASE, ['not_a_capability'])).toBe(BASE);
  });

  it('deduplicates and sorts entitlement keys', () => {
    expect(applyToMacosEntitlements(BASE, ['location', 'location_always']))
      .toResemble(`
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        <key>com.apple.security.app-sandbox</key>
        <true/>
        <!-- fsx:entitlements:begin -->
        <key>com.apple.security.personal-information.location</key>
        <true/>
        <!-- fsx:entitlements:end -->
        </dict>
        </plist>
      `);
  });
});
