import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { widgetTestDart } from '@src/templates/widget-test-dart.js';

const bodyOf = (out: string): string =>
  out.split('\n').slice(1).join('\n').trim();

describe('widgetTestDart', () => {
  it('pumps the root app and asserts no exceptions (no stores)', () => {
    expect(bodyOf(widgetTestDart('counter_app'))).toResemble(`
      import 'package:flutter_test/flutter_test.dart';
      import 'package:counter_app/App.dart';

      void main() {
        testWidgets('app boots without exceptions', (WidgetTester tester) async {
          await tester.pumpWidget(const MainApp());
          expect(tester.takeException(), isNull);
        });
      }`);
  });

  it('wraps the root in a MultiProvider when stores are present (imports deduped)', () => {
    const out = widgetTestDart('counter_app', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(bodyOf(out)).toResemble(`
      import 'package:flutter_test/flutter_test.dart';
      import 'package:provider/provider.dart';
      import 'package:counter_app/App.dart';
      import 'package:counter_app/stores.dart';

      void main() {
        testWidgets('app boots without exceptions', (WidgetTester tester) async {
          await tester.pumpWidget(MultiProvider(
              providers: [
                ChangeNotifierProvider(create: (_) => CounterStore()),
                ChangeNotifierProvider(create: (_) => SessionStore()),
              ],
              child: const MainApp(),
            ));
          expect(tester.takeException(), isNull);
        });
      }`);
  });
});
