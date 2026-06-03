import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { linuxDesktopEntry, windowsSchemeReg } from '@src/flutter/links.js';

describe('linuxDesktopEntry', () => {
  it('registers the custom scheme as an x-scheme-handler MIME type', () => {
    expect(linuxDesktopEntry('myapp', 'My App')).toResemble(`
      [Desktop Entry]
      Type=Application
      Name=My App
      Exec=My App %u
      NoDisplay=true
      MimeType=x-scheme-handler/myapp;
    `);
  });

  it('defaults the display name to the scheme', () => {
    expect(linuxDesktopEntry('myapp')).toResemble(`
      [Desktop Entry]
      Type=Application
      Name=myapp
      Exec=myapp %u
      NoDisplay=true
      MimeType=x-scheme-handler/myapp;
    `);
  });
});

describe('windowsSchemeReg', () => {
  it('writes a URL-protocol registry entry for the scheme', () => {
    expect(windowsSchemeReg('myapp', 'My App')).toResemble(`
      Windows Registry Editor Version 5.00

      [HKEY_CURRENT_USER\\Software\\Classes\\myapp]
      @="URL:My App Protocol"
      "URL Protocol"=""

      [HKEY_CURRENT_USER\\Software\\Classes\\myapp\\shell\\open\\command]
      @="\\"My App.exe\\" \\"%1\\""
    `);
  });
});
