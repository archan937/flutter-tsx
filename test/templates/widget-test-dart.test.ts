import { describe, expect, it } from 'bun:test';

import { widgetTestDart } from '@src/templates/widget-test-dart.js';

describe('widgetTestDart', () => {
  it('pumps the root app and asserts no exceptions (no stores)', () => {
    const out = widgetTestDart('counter_app');
    expect(out).toContain("import 'package:flutter_test/flutter_test.dart';");
    expect(out).toContain("import 'package:counter_app/App.dart';");
    expect(out).toContain('await tester.pumpWidget(const MainApp());');
    expect(out).toContain('expect(tester.takeException(), isNull);');
    expect(out).not.toContain('MyApp');
    expect(out).not.toContain('provider/provider.dart');
  });

  it('wraps the root in MultiProvider when stores are present', () => {
    const out = widgetTestDart('counter_app', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(out).toContain("import 'package:provider/provider.dart';");
    expect(out).toContain("import 'package:counter_app/stores.dart';");
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
    const out = widgetTestDart('counter_app', [
      { className: 'CounterStore', importFile: 'stores.dart' },
      { className: 'SessionStore', importFile: 'stores.dart' },
    ]);
    expect(
      out.match(/import 'package:counter_app\/stores\.dart';/g),
    ).toHaveLength(1);
  });
});
