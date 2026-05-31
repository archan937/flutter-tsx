import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const dartOf = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports);
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

  it('renders the TabView as a generated stateful widget reference', () => {
    expect(dartOf(APP)).toContain('return _FsxTabs0();');
  });

  it('generates a private StatefulWidget holding the tab index', () => {
    const out = dartOf(APP);
    expect(out).toContain('class _FsxTabs0 extends StatefulWidget {');
    expect(out).toContain('class _FsxTabs0State extends State<_FsxTabs0> {');
    expect(out).toContain('int _index = 0;');
  });

  it('swaps screens with an IndexedStack', () => {
    expect(dartOf(APP)).toContain(
      'IndexedStack(index: _index, children: [Home(), Profile()])',
    );
  });

  it('builds the BottomNavigationBar with items + onTap setState', () => {
    const out = dartOf(APP);
    expect(out).toContain('bottomNavigationBar: BottomNavigationBar(');
    expect(out).toContain('currentIndex: _index');
    expect(out).toContain('onTap: (i) => setState(() => _index = i)');
    expect(out).toContain(
      "BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home')",
    );
    expect(out).toContain(
      "BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile')",
    );
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

  it('rewrites showSheet(<X/>) to showModalBottomSheet', () => {
    expect(dartOf(BAR)).toContain(
      'showModalBottomSheet(context: context, builder: (context) => CartView())',
    );
  });

  it('rewrites showDialog(<X/>) to Flutter showDialog', () => {
    expect(dartOf(BAR)).toContain(
      'showDialog(context: context, builder: (context) => ConfirmDelete())',
    );
  });
});
