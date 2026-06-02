import '../../test/helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { mainDart, trayMainDart } from '@src/templates/main-dart.js';

// Drop the long ignore_for_file header line so the expected snippets stay readable.
const bodyOf = (out: string): string =>
  out.split('\n').slice(1).join('\n').trim();

describe('mainDart', () => {
  it('runs the app widget directly when there are no stores (default name MainApp)', () => {
    const expected = `
      import 'package:flutter/material.dart';
      import 'App.dart';

      void main() {
        runApp(const MainApp());
      }`;
    expect(bodyOf(mainDart('MainApp'))).toResemble(expected);
    expect(bodyOf(mainDart())).toResemble(expected); // name defaults to MainApp
  });

  it('wraps the app in a MultiProvider when stores are present (imports deduped)', () => {
    const out = mainDart('MainApp', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(bodyOf(out)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:provider/provider.dart';
      import 'App.dart';
      import 'stores.dart';

      void main() {
        runApp(MultiProvider(
            providers: [
              ChangeNotifierProvider(create: (_) => CounterStore()),
              ChangeNotifierProvider(create: (_) => SessionStore()),
            ],
            child: const MainApp(),
          ));
      }`);
  });
});

describe('trayMainDart', () => {
  const TRAY = {
    tooltip: 'My App',
    menu: [
      { label: 'Show', action: 'show' as const },
      { label: 'Hide', action: 'hide' as const },
      { label: 'Quit', action: 'quit' as const },
    ],
  };

  it('emits the full window_manager + tray_manager bootstrap (template icon, menu, keep-alive)', () => {
    expect(bodyOf(trayMainDart('MainApp', [], TRAY))).toResemble(`
      import 'dart:io';
      import 'package:flutter/material.dart';
      import 'package:tray_manager/tray_manager.dart';
      import 'package:window_manager/window_manager.dart';
      import 'App.dart';

      class _FsxTray with TrayListener, WindowListener {
        @override
        void onTrayIconMouseDown() => trayManager.popUpContextMenu();
        @override
        void onTrayIconRightMouseDown() => trayManager.popUpContextMenu();
        @override
        void onTrayMenuItemClick(MenuItem menuItem) {
          if (menuItem.key == 'show') windowManager.show();
          if (menuItem.key == 'hide') windowManager.hide();
          if (menuItem.key == 'quit') exit(0);
        }

        // Closing the window hides it to the tray instead of quitting the app.
        @override
        void onWindowClose() async {
          if (await windowManager.isPreventClose()) windowManager.hide();
        }
      }

      Future<void> main() async {
        WidgetsFlutterBinding.ensureInitialized();
        await windowManager.ensureInitialized();
        // Keep the app alive in the tray when its window is hidden or closed.
        await windowManager.setPreventClose(true);
        // On macOS render as a template image so the menubar tints it automatically
        // (black on light menubars, white on dark) — a fixed-colour icon is invisible
        // in one mode. Windows/Linux ignore isTemplate and use the icon as-is.
        await trayManager.setIcon('assets/tray_icon.png', isTemplate: Platform.isMacOS);
        await trayManager.setToolTip('My App');
        await trayManager.setContextMenu(Menu(items: [
            MenuItem(key: 'show', label: 'Show'),
            MenuItem(key: 'hide', label: 'Hide'),
            MenuItem(key: 'quit', label: 'Quit'),
        ]));
        final fsxTray = _FsxTray();
        trayManager.addListener(fsxTray);
        windowManager.addListener(fsxTray);
        runApp(const MainApp());
      }`);
  });

  it('wraps the app in a MultiProvider when stores are present', () => {
    expect(
      bodyOf(
        trayMainDart(
          'myapp',
          [{ className: 'SessionStore', importFile: 'session.dart' }],
          { menu: [{ label: 'Quit', action: 'quit' as const }] },
        ),
      ),
    ).toResemble(`
      import 'dart:io';
      import 'package:flutter/material.dart';
      import 'package:tray_manager/tray_manager.dart';
      import 'package:window_manager/window_manager.dart';
      import 'package:provider/provider.dart';
      import 'App.dart';
      import 'session.dart';

      class _FsxTray with TrayListener, WindowListener {
        @override
        void onTrayIconMouseDown() => trayManager.popUpContextMenu();
        @override
        void onTrayIconRightMouseDown() => trayManager.popUpContextMenu();
        @override
        void onTrayMenuItemClick(MenuItem menuItem) {
          if (menuItem.key == 'quit') exit(0);
        }

        // Closing the window hides it to the tray instead of quitting the app.
        @override
        void onWindowClose() async {
          if (await windowManager.isPreventClose()) windowManager.hide();
        }
      }

      Future<void> main() async {
        WidgetsFlutterBinding.ensureInitialized();
        await windowManager.ensureInitialized();
        // Keep the app alive in the tray when its window is hidden or closed.
        await windowManager.setPreventClose(true);
        // On macOS render as a template image so the menubar tints it automatically
        // (black on light menubars, white on dark) — a fixed-colour icon is invisible
        // in one mode. Windows/Linux ignore isTemplate and use the icon as-is.
        await trayManager.setIcon('assets/tray_icon.png', isTemplate: Platform.isMacOS);
        await trayManager.setToolTip('myapp');
        await trayManager.setContextMenu(Menu(items: [
            MenuItem(key: 'quit', label: 'Quit'),
        ]));
        final fsxTray = _FsxTray();
        trayManager.addListener(fsxTray);
        windowManager.addListener(fsxTray);
        runApp(MultiProvider(
            providers: [
              ChangeNotifierProvider(create: (_) => SessionStore()),
            ],
            child: const myapp(),
          ));
      }`);
  });
});
