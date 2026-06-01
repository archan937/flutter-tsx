import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { transpileAll, transpileFile } from '@src/transpiler/index.js';

const bodyOf = (dart: string): string =>
  dart.split('\n').slice(2).join('\n').trim();

const mkTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-transpile-'));

const writeSrc = (dir: string, rel: string, content: string): void => {
  const path = join(dir, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
};

describe('transpileAll — file-based routing (src/routes/)', () => {
  const readDart = (dir: string, name: string): string =>
    readFileSync(join(dir, 'out', name), 'utf-8');

  const scaffold = (): string => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'App.tsx',
      `export const App = () => (<MaterialApp title="X" routes="./routes" />);`,
    );
    writeSrc(
      src,
      'routes/index.tsx',
      `export const Home = () => (<Center><Text>home</Text></Center>);`,
    );
    writeSrc(
      src,
      'routes/users/[id].tsx',
      `export const UserScreen = () => (<Center><Text>user</Text></Center>);`,
    );
    return dir;
  };

  it('rewrites the app MaterialApp to MaterialApp.router with a GoRouter', async () => {
    const dir = scaffold();
    await transpileAll(join(dir, 'src'), join(dir, 'out'));
    expect(bodyOf(readDart(dir, 'App.dart'))).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:go_router/go_router.dart';
      import 'Home.dart';
      import 'UserScreen.dart';

      final _fsxRouter = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (context, state) => Home()),
          GoRoute(path: '/users/:id', builder: (context, state) => UserScreen()),
        ],
      );

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return MaterialApp.router(routerConfig: _fsxRouter, title: 'X');
        }
      }`);
  });

  it('emits each route component to a Dart file named after the component', async () => {
    const dir = scaffold();
    await transpileAll(join(dir, 'src'), join(dir, 'out'));
    expect(bodyOf(readDart(dir, 'Home.dart'))).toResemble(`
      import 'package:flutter/material.dart';

      class Home extends StatelessWidget {
        const Home({super.key});
        @override
        Widget build(BuildContext context) {
          return Center(child: Text('home'));
        }
      }`);
    expect(bodyOf(readDart(dir, 'UserScreen.dart'))).toResemble(`
      import 'package:flutter/material.dart';

      class UserScreen extends StatelessWidget {
        const UserScreen({super.key});
        @override
        Widget build(BuildContext context) {
          return Center(child: Text('user'));
        }
      }`);
  });

  it('collects go_router as a pubspec dependency', async () => {
    const dir = scaffold();
    const results = await transpileAll(join(dir, 'src'), join(dir, 'out'));
    expect(
      results
        .flatMap((r) => r.packages)
        .some((p) => p.startsWith('go_router:')),
    ).toBe(true);
  });

  it('leaves a routes-less app as single-screen home: (backward compat)', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'App.tsx',
      `export const App = () => (<MaterialApp title="X"><Scaffold/></MaterialApp>);`,
    );
    await transpileAll(join(dir, 'src'), join(dir, 'out'));
    expect(bodyOf(readDart(dir, 'App.dart'))).toResemble(`
      import 'package:flutter/material.dart';

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return MaterialApp(title: 'X', home: Scaffold());
        }
      }`);
  });
});

describe('transpileFile', () => {
  it('returns an empty result for a file with no exported component', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'helpers.tsx', `const x = 1;\n`);
    const result = await transpileFile(
      join(src, 'helpers.tsx'),
      join(dir, 'out'),
    );
    expect(result.path).toBe('');
    expect(result.packages).toEqual([]);
  });

  it('collects pubspec packages from used plugin hooks', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'Cam.tsx',
      `import { useCamera } from 'flutter-tsx';\n` +
        `export const Cam = () => {\n` +
        `  const cam = useCamera();\n` +
        `  return <Center />;\n` +
        `};\n`,
    );
    const result = await transpileFile(join(src, 'Cam.tsx'), join(dir, 'out'));
    expect(result.packages.some((p) => p.startsWith('camera:'))).toBe(true);
  });

  it('infers permission capabilities from used plugin hooks', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'Cam.tsx',
      `import { useCamera } from 'flutter-tsx';\n` +
        `export const Cam = () => {\n` +
        `  const cam = useCamera();\n` +
        `  return <Center />;\n` +
        `};\n`,
    );
    const result = await transpileFile(join(src, 'Cam.tsx'), join(dir, 'out'));
    expect(result.capabilities).toContain('camera');
  });
});

describe('transpileAll', () => {
  it('transpiles every .tsx in the source tree', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'App.tsx', `export const App = () => <Center />;\n`);
    writeSrc(
      src,
      'screens/Home.tsx',
      `export const Home = () => <Center />;\n`,
    );
    const results = await transpileAll(src, join(dir, 'out'));
    expect(results.length).toBe(2);
  });

  it('throws when a file fails to transpile (surfacing the error)', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'App.tsx', `export const App = () => <Center />;\n`);
    // outDir's parent is a FILE → mkdirSync fails inside transpileFile → rejected.
    const blocker = join(dir, 'blocker');
    writeFileSync(blocker, 'not a dir', 'utf-8');
    await expect(transpileAll(src, join(blocker, 'out'))).rejects.toThrow(
      /failed to transpile/,
    );
  });
});

describe('transpileAll — cross-file stores (createStore)', () => {
  const scaffold = (): string => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'stores.tsx',
      `import { createStore } from 'flutter-tsx';
       export const useCounter = createStore((set) => ({
         count: 0,
         increment: () => set((s) => ({ count: s.count + 1 })),
       }));`,
    );
    writeSrc(
      src,
      'screens/Counter.tsx',
      `import { createStore, Column, Text, ElevatedButton } from 'flutter-tsx';
       import { useCounter } from '../stores';
       export const Counter = () => {
         const { count, increment } = useCounter();
         return (
           <Column>
             <Text>{count}</Text>
             <ElevatedButton onClick={increment}>Add</ElevatedButton>
           </Column>
         );
       };`,
    );
    return dir;
  };

  it('emits the ChangeNotifier class in the store-only file', async () => {
    const dir = scaffold();
    await transpileAll(join(dir, 'src'), join(dir, 'out'));
    const stores = readFileSync(join(dir, 'out', 'stores.dart'), 'utf-8');
    expect(bodyOf(stores)).toResemble(`
      import 'package:flutter/material.dart';

      class CounterStore extends ChangeNotifier {
        int count = 0;
        void increment() {
          count = count + 1;
          notifyListeners();
        }
      }`);
  });

  it('rewrites cross-file usage to context.watch + imports the store file', async () => {
    const dir = scaffold();
    await transpileAll(join(dir, 'src'), join(dir, 'out'));
    const screen = readFileSync(join(dir, 'out', 'Counter.dart'), 'utf-8');
    expect(bodyOf(screen)).toResemble(`
      import 'package:flutter/material.dart';
      import 'package:provider/provider.dart';
      import 'stores.dart';

      class Counter extends StatelessWidget {
        const Counter({super.key});
        @override
        Widget build(BuildContext context) {
          final counterStore = context.watch<CounterStore>();
          final count = counterStore.count;
          final increment = counterStore.increment;
          return Column(children: [Text('$count'), ElevatedButton(onPressed: increment, child: Text('Add'))]);
        }
      }`);
  });

  it('reports the store provider + the provider pubspec dep', async () => {
    const dir = scaffold();
    const results = await transpileAll(join(dir, 'src'), join(dir, 'out'));
    const stores = results.flatMap((r) => r.stores);
    expect(stores).toContainEqual({
      className: 'CounterStore',
      importFile: 'stores.dart',
    });
    expect(results.flatMap((r) => r.packages)).toContain('provider: ^6.1.2');
  });
});
