import { GENERATED_IGNORES } from '../dart-lint.js';
import type { StoreProvider } from './main-dart.js';

/**
 * A smoke test that pumps the app's root widget (with its store providers, when
 * any) and asserts it boots without throwing. Replaces the `MyApp`-referencing
 * default that `flutter create` emits — which fails `flutter analyze` because
 * fsx apps never define `MyApp`.
 */
export const widgetTestDart = (
  appName: string,
  stores: StoreProvider[] = [],
): string => {
  const storeImports = [...new Set(stores.map((s) => s.importFile))]
    .map((file) => `import 'package:${appName}/${file}';`)
    .join('\n');
  const providerImport = stores.length
    ? "import 'package:provider/provider.dart';\n"
    : '';

  const tree = stores.length
    ? `MultiProvider(
        providers: [
${stores
  .map(
    (s) => `          ChangeNotifierProvider(create: (_) => ${s.className}()),`,
  )
  .join('\n')}
        ],
        child: const MainApp(),
      )`
    : 'const MainApp()';

  return `${GENERATED_IGNORES}
import 'package:flutter_test/flutter_test.dart';
${providerImport}import 'package:${appName}/App.dart';
${storeImports}

void main() {
  testWidgets('app boots without exceptions', (WidgetTester tester) async {
    await tester.pumpWidget(${tree});
    expect(tester.takeException(), isNull);
  });
}
`;
};
