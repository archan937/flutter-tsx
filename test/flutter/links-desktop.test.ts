import { describe, expect, it } from 'bun:test';

import { linuxDesktopEntry, windowsSchemeReg } from '@src/flutter/links.js';

describe('linuxDesktopEntry', () => {
  it('registers the custom scheme as an x-scheme-handler MIME type', () => {
    const entry = linuxDesktopEntry('myapp', 'My App');
    expect(entry).toContain('MimeType=x-scheme-handler/myapp;');
    expect(entry).toContain('[Desktop Entry]');
    expect(entry).toContain('Name=My App');
    expect(entry).toContain('Exec=');
  });

  it('defaults the display name to the scheme', () => {
    expect(linuxDesktopEntry('myapp')).toContain('Name=myapp');
  });
});

describe('windowsSchemeReg', () => {
  it('writes a URL-protocol registry entry for the scheme', () => {
    const reg = windowsSchemeReg('myapp', 'My App');
    expect(reg).toContain('Windows Registry Editor');
    expect(reg).toContain('[HKEY_CURRENT_USER\\Software\\Classes\\myapp]');
    expect(reg).toContain('"URL Protocol"=""');
    expect(reg).toContain('shell\\open\\command');
  });
});
