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

describe('MACOS_ENTITLEMENT_MAP', () => {
  it('maps core capabilities to com.apple.security.* entitlements', () => {
    expect(MACOS_ENTITLEMENT_MAP.camera).toContain(
      'com.apple.security.device.camera',
    );
    expect(MACOS_ENTITLEMENT_MAP.microphone).toContain(
      'com.apple.security.device.audio-input',
    );
    expect(MACOS_ENTITLEMENT_MAP.location).toContain(
      'com.apple.security.personal-information.location',
    );
  });
});

describe('applyToMacosEntitlements', () => {
  it('adds a boolean entitlement for an inferred capability', () => {
    const out = applyToMacosEntitlements(BASE, ['camera']);
    expect(out).toContain('<key>com.apple.security.device.camera</key>');
    // boolean entitlement → <true/> follows the key
    expect(out).toMatch(
      /<key>com\.apple\.security\.device\.camera<\/key>\s*\n\s*<true\/>/,
    );
  });

  it('preserves the existing app-sandbox entitlement', () => {
    const out = applyToMacosEntitlements(BASE, ['camera']);
    expect(out).toContain('<key>com.apple.security.app-sandbox</key>');
    expect(out.trimEnd().endsWith('</plist>')).toBe(true);
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
    const out = applyToMacosEntitlements(BASE, ['location', 'location_always']);
    const matches = out.match(
      /com\.apple\.security\.personal-information\.location/g,
    );
    expect(matches?.length).toBe(1);
  });
});
