import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

describe('TabView → BottomNavigationBar + IndexedStack', () => {
  const APP = `
    import { TabView } from 'flutter-tsx';
    export const App = () => (
      <TabView tabs={[
        { label: 'Home', icon: 'home', screen: <Home /> },
        { label: 'Profile', icon: 'person', screen: <Profile /> },
      ]} />
    );
  `;

  it('generates a private indexed StatefulWidget (BottomNavigationBar + IndexedStack)', () => {
    expect(dartOf(APP)).toResemble(`
      import 'package:flutter/material.dart';

      class _FsxTabs0 extends StatefulWidget {
        const _FsxTabs0({super.key});
        @override
        State<_FsxTabs0> createState() => _FsxTabs0State();
      }

      class _FsxTabs0State extends State<_FsxTabs0> {
        int _index = 0;
        @override
        Widget build(BuildContext context) {
          return Scaffold(
            body: IndexedStack(index: _index, children: [Home(), Profile()]),
            bottomNavigationBar: BottomNavigationBar(
              currentIndex: _index,
              onTap: (i) => setState(() => _index = i),
              items: const [BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'), BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile')],
            ),
          );
        }
      }

      class App extends StatelessWidget {
        const App({super.key});
        @override
        Widget build(BuildContext context) {
          return _FsxTabs0();
        }
      }`);
  });
});

describe('Modal — showSheet / showDialog', () => {
  const BAR = `
    import { showSheet, showDialog, Column, ElevatedButton } from 'flutter-tsx';
    export const Bar = () => (
      <Column>
        <ElevatedButton onClick={() => showSheet(<CartView />)}>Cart</ElevatedButton>
        <ElevatedButton onClick={() => showDialog(<ConfirmDelete />)}>Delete</ElevatedButton>
      </Column>
    );
  `;

  it('rewrites showSheet/showDialog(<X/>) to the Flutter modal builders', () => {
    expect(dartOf(BAR)).toResemble(`
      import 'package:flutter/material.dart';

      class Bar extends StatelessWidget {
        const Bar({super.key});
        @override
        Widget build(BuildContext context) {
          return Column(children: [ElevatedButton(onPressed: () { showModalBottomSheet(context: context, builder: (context) => CartView()); }, child: Text('Cart')), ElevatedButton(onPressed: () { showDialog(context: context, builder: (context) => ConfirmDelete()); }, child: Text('Delete'))]);
        }
      }`);
  });
});
