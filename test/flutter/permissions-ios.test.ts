import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import {
  applyToInfoPlist,
  applyToPrivacyManifest,
} from '@src/flutter/permissions.js';

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
    expect(applyToInfoPlist(emptyPlist, { camera: 'For QR scanning' }))
      .toResemble(`
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        <!-- fsx:permissions:begin -->
        <key>NSCameraUsageDescription</key>
        <string>For QR scanning</string>
        <!-- fsx:permissions:end -->
        </dict>
        </plist>
      `);
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
    expect(initial).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:permissions:begin -->
      <key>NSCameraUsageDescription</key>
      <string>A</string>
      <key>NSMicrophoneUsageDescription</key>
      <string>B</string>
      <!-- fsx:permissions:end -->
      </dict>
      </plist>
    `);

    expect(applyToInfoPlist(initial, { camera: 'A' })).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:permissions:begin -->
      <key>NSCameraUsageDescription</key>
      <string>A</string>
      <!-- fsx:permissions:end -->
      </dict>
      </plist>
    `);
  });

  it('preserves unrelated plist keys', () => {
    expect(applyToInfoPlist(plistWithBundleName, { camera: 'For QR scanning' }))
      .toResemble(`
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
        <key>CFBundleName</key>
        <string>MyApp</string>
        <!-- fsx:permissions:begin -->
        <key>NSCameraUsageDescription</key>
        <string>For QR scanning</string>
        <!-- fsx:permissions:end -->
        </dict>
        </plist>
      `);
  });
});

describe('applyToPrivacyManifest', () => {
  it('adds an entry for tracking', () => {
    expect(applyToPrivacyManifest(emptyPrivacyManifest, {
      tracking: 'Improve our ads',
    })).toResemble(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
      <!-- fsx:privacy:begin -->
      <key>NSPrivacyAccessedAPITypes</key>
      <array>
      <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>tracking</string>
      </dict>
      </array>
      <!-- fsx:privacy:end -->
      </dict>
      </plist>
    `);
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
