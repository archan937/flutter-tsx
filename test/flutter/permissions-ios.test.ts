import {
  applyToInfoPlist,
  applyToPrivacyManifest,
} from '@src/flutter/permissions.js';
import { describe, expect, it } from 'bun:test';

const emptyPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;

const plistWithBundleName = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>MyApp</string>
</dict>
</plist>
`;

const emptyPrivacyManifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;

describe('applyToInfoPlist', () => {
  it('adds NSCameraUsageDescription for camera', () => {
    const out = applyToInfoPlist(emptyPlist, {
      camera: 'For QR scanning',
    });
    expect(out).toContain('<key>NSCameraUsageDescription</key>');
    expect(out).toContain('<string>For QR scanning</string>');
  });

  it('is idempotent on second apply', () => {
    const first = applyToInfoPlist(emptyPlist, { camera: 'For QR scanning' });
    const second = applyToInfoPlist(first, { camera: 'For QR scanning' });
    expect(second).toBe(first);
  });

  it('drops a stale key when re-applied with reduced permissions', () => {
    const initial = applyToInfoPlist(emptyPlist, {
      camera: 'A',
      microphone: 'B',
    });
    expect(initial).toContain('NSCameraUsageDescription');
    expect(initial).toContain('NSMicrophoneUsageDescription');

    const after = applyToInfoPlist(initial, { camera: 'A' });
    expect(after).toContain('NSCameraUsageDescription');
    expect(after).not.toContain('NSMicrophoneUsageDescription');
  });

  it('preserves unrelated plist keys', () => {
    const out = applyToInfoPlist(plistWithBundleName, {
      camera: 'For QR scanning',
    });
    expect(out).toContain('<key>CFBundleName</key>');
    expect(out).toContain('<string>MyApp</string>');
    expect(out).toContain('NSCameraUsageDescription');
  });
});

describe('applyToPrivacyManifest', () => {
  it('adds an entry for tracking', () => {
    const out = applyToPrivacyManifest(emptyPrivacyManifest, {
      tracking: 'Improve our ads',
    });
    expect(out).toContain('NSPrivacyAccessedAPITypes');
  });

  it('is idempotent', () => {
    const first = applyToPrivacyManifest(emptyPrivacyManifest, {
      tracking: 'Improve our ads',
    });
    const second = applyToPrivacyManifest(first, {
      tracking: 'Improve our ads',
    });
    expect(second).toBe(first);
  });
});
