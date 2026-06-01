import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';
import '../helpers/resemble.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

describe('createStore → ChangeNotifier class', () => {
  it('maps state→typed fields + actions→mutating notifyListeners methods', () => {
    const src = `
      import { createStore } from 'flutter-tsx';
      export const useCounter = createStore((set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
        reset: () => set(() => ({ count: 0 })),
      }));
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';

      class CounterStore extends ChangeNotifier {
        int count = 0;
        void increment() {
          count = count + 1;
          notifyListeners();
        }
        void reset() {
          count = 0;
          notifyListeners();
        }
      }`);
  });

  it('infers field types (String/bool) from initial values', () => {
    const src = `
      import { createStore } from 'flutter-tsx';
      export const useSession = createStore((set) => ({
        name: 'guest',
        loggedIn: false,
        logout: () => set(() => ({ loggedIn: false, name: 'guest' })),
      }));
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';

      class SessionStore extends ChangeNotifier {
        String name = 'guest';
        bool loggedIn = false;
        void logout() {
          loggedIn = false;
          name = 'guest';
          notifyListeners();
        }
      }`);
  });
});

describe('store-hook usage in screens', () => {
  it('binds context.watch + pre-binds destructured state/actions + imports provider', () => {
    const src = `
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
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:provider/provider.dart';

      class CounterStore extends ChangeNotifier {
        int count = 0;
        void increment() {
          count = count + 1;
          notifyListeners();
        }
      }

      class CounterScreen extends StatelessWidget {
        const CounterScreen({super.key});
        @override
        Widget build(BuildContext context) {
          final counterStore = context.watch<CounterStore>();
          final count = counterStore.count;
          final increment = counterStore.increment;
          return Column(children: [Text('$count'), ElevatedButton(onPressed: increment, child: Text('Add'))]);
        }
      }`);
  });

  it('supports the non-destructured form', () => {
    const src = `
      import { createStore, Text } from 'flutter-tsx';
      export const useCounter = createStore(() => ({ count: 0 }));
      export const Screen = () => {
        const counter = useCounter();
        return <Text>{counter.count}</Text>;
      };
    `;
    expect(dartOf(src)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:provider/provider.dart';

      class CounterStore extends ChangeNotifier {
        int count = 0;
      }

      class Screen extends StatelessWidget {
        const Screen({super.key});
        @override
        Widget build(BuildContext context) {
          final counter = context.watch<CounterStore>();
          return Text('\${counter.count}');
        }
      }`);
  });
});
