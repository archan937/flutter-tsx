import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports);
};

describe('createStore → ChangeNotifier class', () => {
  const COUNTER = `
    import { createStore } from 'flutter-tsx';
    export const useCounter = createStore((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
      reset: () => set(() => ({ count: 0 })),
    }));
  `;

  it('names the class <Name>Store and extends ChangeNotifier', () => {
    expect(dartOf(COUNTER)).toContain(
      'class CounterStore extends ChangeNotifier {',
    );
  });

  it('maps state props to typed fields', () => {
    expect(dartOf(COUNTER)).toContain('int count = 0;');
  });

  it('maps actions to methods that mutate + notifyListeners', () => {
    const out = dartOf(COUNTER);
    expect(out).toContain('void increment() {');
    expect(out).toContain('count = count + 1;');
    expect(out).toContain('void reset() {');
    expect(out).toContain('count = 0;');
    expect(out).toContain('notifyListeners();');
  });

  it('infers field types (String/bool) from initial values', () => {
    const out = dartOf(`
      import { createStore } from 'flutter-tsx';
      export const useSession = createStore((set) => ({
        name: 'guest',
        loggedIn: false,
        logout: () => set(() => ({ loggedIn: false, name: 'guest' })),
      }));
    `);
    expect(out).toContain("String name = 'guest';");
    expect(out).toContain('bool loggedIn = false;');
    expect(out).toContain('class SessionStore extends ChangeNotifier {');
  });
});

describe('store-hook usage in screens', () => {
  const SCREEN = `
    import { createStore, Column, Text, ElevatedButton } from 'flutter-tsx';
    export const useCounter = createStore((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    export const CounterScreen = () => {
      const { count, increment } = useCounter();
      return (
        <Column>
          <Text>{count}</Text>
          <ElevatedButton onClick={increment}>Add</ElevatedButton>
        </Column>
      );
    };
  `;

  it('binds the store via context.watch<Store>()', () => {
    expect(dartOf(SCREEN)).toContain(
      'final counterStore = context.watch<CounterStore>();',
    );
  });

  it('pre-binds destructured state + actions as locals', () => {
    const out = dartOf(SCREEN);
    expect(out).toContain('final count = counterStore.count;');
    expect(out).toContain('final increment = counterStore.increment;');
  });

  it('imports the provider package when a store hook is used', () => {
    expect(dartOf(SCREEN)).toContain(
      "import 'package:provider/provider.dart';",
    );
  });

  it('supports the non-destructured form', () => {
    const out = dartOf(`
      import { createStore, Text } from 'flutter-tsx';
      export const useCounter = createStore(() => ({ count: 0 }));
      export const Screen = () => {
        const counter = useCounter();
        return <Text>{counter.count}</Text>;
      };
    `);
    expect(out).toContain('final counter = context.watch<CounterStore>();');
  });
});
