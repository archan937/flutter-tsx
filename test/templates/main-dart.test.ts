import { describe, expect, it } from 'bun:test';

import { mainDart, trayMainDart } from '@src/templates/main-dart.js';

describe('mainDart', () => {
  it('runs the app widget directly when there are no stores', () => {
    const out = mainDart('MainApp');
    expect(out).toContain('runApp(const MainApp());');
    expect(out).not.toContain('MultiProvider');
    expect(out).not.toContain('provider/provider.dart');
  });

  it('defaults the widget name to MainApp', () => {
    expect(mainDart()).toContain('runApp(const MainApp());');
  });

  it('wraps the app in MultiProvider when stores are present', () => {
    const out = mainDart('MainApp', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(out).toContain("import 'package:provider/provider.dart';");
    expect(out).toContain("import 'stores.dart';");
    expect(out).toContain('MultiProvider(');
    expect(out).toContain(
      'ChangeNotifierProvider(create: (_) => CounterStore()),',
    );
    expect(out).toContain(
      'ChangeNotifierProvider(create: (_) => SessionStore()),',
    );
    expect(out).toContain('child: const MainApp(),');
  });

  it('deduplicates store import files', () => {
    const out = mainDart('MainApp', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(out.match(/import 'stores\.dart';/g)).toHaveLength(1);
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

  it('emits an async main with window_manager + tray_manager bootstrap', () => {
    const out = trayMainDart('MainApp', [], TRAY);
    expect(out).toContain("import 'package:tray_manager/tray_manager.dart';");
    expect(out).toContain(
      "import 'package:window_manager/window_manager.dart';",
    );
    expect(out).toContain('Future<void> main() async {');
    expect(out).toContain('await windowManager.ensureInitialized();');
    expect(out).toContain("await trayManager.setIcon('assets/tray_icon.png');");
    expect(out).toContain("await trayManager.setToolTip('My App');");
    expect(out).toContain('trayManager.addListener(');
    expect(out).toContain('runApp(const MainApp());');
  });

  it('builds the context menu from config + wires Show/Hide/Quit', () => {
    const out = trayMainDart('MainApp', [], TRAY);
    expect(out).toContain("MenuItem(key: 'show', label: 'Show')");
    expect(out).toContain("MenuItem(key: 'quit', label: 'Quit')");
    expect(out).toContain("if (menuItem.key == 'show') windowManager.show();");
    expect(out).toContain("if (menuItem.key == 'hide') windowManager.hide();");
    expect(out).toContain("if (menuItem.key == 'quit') exit(0);");
  });

  it('wraps the app in MultiProvider when stores are present', () => {
    const out = trayMainDart(
      'myapp',
      [{ className: 'SessionStore', importFile: 'session.dart' }],
      { menu: [{ label: 'Quit', action: 'quit' as const }] },
    );
    expect(out).toContain("import 'package:provider/provider.dart';");
    expect(out).toContain('MultiProvider(');
    expect(out).toContain(
      'ChangeNotifierProvider(create: (_) => SessionStore())',
    );
  });

  it('keeps the app alive in the tray: prevents close + hides on window close', () => {
    // Without this, hiding/closing the only window quits the app (the macOS
    // applicationShouldTerminateAfterLastWindowClosed default).
    const out = trayMainDart('MainApp', [], TRAY);
    expect(out).toContain('await windowManager.setPreventClose(true);');
    expect(out).toContain('with TrayListener, WindowListener');
    expect(out).toContain('void onWindowClose() async {');
    expect(out).toContain(
      'if (await windowManager.isPreventClose()) windowManager.hide();',
    );
    expect(out).toContain('windowManager.addListener(fsxTray);');
  });
});
