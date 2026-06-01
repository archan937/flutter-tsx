import type { TrayConfig } from '../config.js';
import { GENERATED_IGNORES } from '../dart-lint.js';

/** A store whose `ChangeNotifier` should be provided at the app root. */
export interface StoreProvider {
  className: string;
  importFile: string;
}

const storeImportBlock = (stores: StoreProvider[]): string =>
  stores.length === 0
    ? ''
    : [...new Set(stores.map((s) => s.importFile))]
        .map((file) => `import '${file}';`)
        .join('\n') + '\n';

const providerImport = (stores: StoreProvider[]): string =>
  stores.length === 0 ? '' : "import 'package:provider/provider.dart';\n";

/** The `runApp(...)` argument: the root widget, wrapped in MultiProvider when stores exist. */
const appRootTree = (
  appWidgetName: string,
  stores: StoreProvider[],
): string => {
  if (stores.length === 0) return `const ${appWidgetName}()`;
  const providers = stores
    .map(
      (s) => `        ChangeNotifierProvider(create: (_) => ${s.className}()),`,
    )
    .join('\n');
  return `MultiProvider(
      providers: [
${providers}
      ],
      child: const ${appWidgetName}(),
    )`;
};

export const mainDart = (
  appWidgetName = 'MainApp',
  stores: StoreProvider[] = [],
): string =>
  `${GENERATED_IGNORES}
import 'package:flutter/material.dart';
${providerImport(stores)}import 'App.dart';
${storeImportBlock(stores)}
void main() {
  runApp(${appRootTree(appWidgetName, stores)});
}
`;

const TRAY_ACTION_HANDLER: Record<string, string> = {
  show: "    if (menuItem.key == 'show') windowManager.show();",
  hide: "    if (menuItem.key == 'hide') windowManager.hide();",
  quit: "    if (menuItem.key == 'quit') exit(0);",
};

/**
 * System-tray / menubar bootstrap: async `main()` initializing `window_manager`
 * + `tray_manager`, the tray icon + context menu (from `config/tray.ts`), and a
 * `TrayListener` that wires Show/Hide/Quit. The window UI is the normal app.
 */
export const trayMainDart = (
  appWidgetName: string,
  stores: StoreProvider[],
  tray: TrayConfig,
): string => {
  const menuItems = tray.menu
    .map((m) => `      MenuItem(key: '${m.action}', label: '${m.label}'),`)
    .join('\n');
  const handlers = [...new Set(tray.menu.map((m) => m.action))]
    .map((action) => TRAY_ACTION_HANDLER[action])
    .filter(Boolean)
    .join('\n');
  const tooltip = tray.tooltip ?? appWidgetName;

  return `${GENERATED_IGNORES}
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';
${providerImport(stores)}import 'App.dart';
${storeImportBlock(stores)}
class _FsxTray with TrayListener, WindowListener {
  @override
  void onTrayIconMouseDown() => trayManager.popUpContextMenu();
  @override
  void onTrayIconRightMouseDown() => trayManager.popUpContextMenu();
  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
${handlers}
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
  await trayManager.setIcon('assets/tray_icon.png');
  await trayManager.setToolTip('${tooltip}');
  await trayManager.setContextMenu(Menu(items: [
${menuItems}
  ]));
  final fsxTray = _FsxTray();
  trayManager.addListener(fsxTray);
  windowManager.addListener(fsxTray);
  runApp(${appRootTree(appWidgetName, stores)});
}
`;
};
