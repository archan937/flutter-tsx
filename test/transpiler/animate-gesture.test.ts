import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';
import '../helpers/resemble.js';

const body = (jsx: string): string => {
  const src = `export function App() { return ${jsx}; }`;
  const { sourceFile, exports } = parseSource(src);
  // Drop the generated header (comment + ignores + import + blank).
  return generateDartFile(sourceFile, exports).split('\n').slice(4).join('\n').trim();
};

const cls = (returnExpr: string): string => `
  class App extends StatelessWidget {
    const App({super.key});
    @override
    Widget build(BuildContext context) {
      return ${returnExpr};
    }
  }`;

describe('gesture props on any widget', () => {
  it('auto-wraps a non-gesture widget in GestureDetector for onTap', () => {
    expect(body(`<Container onTap={() => select(1)}><Text>hi</Text></Container>`)).toResemble(
      cls(`GestureDetector(onTap: () { select(1); }, child: Container(child: Text('hi')))`),
    );
  });

  it('supports onLongPress and onDoubleTap', () => {
    expect(
      body(`<Container onLongPress={() => a()} onDoubleTap={() => b()}><Text>x</Text></Container>`),
    ).toResemble(
      cls(`GestureDetector(onDoubleTap: () { b(); }, onLongPress: () { a(); }, child: Container(child: Text('x')))`),
    );
  });

  it('passes gestures through natively (no double-wrap) on GestureDetector', () => {
    expect(body(`<GestureDetector onTap={() => f()}><Text>x</Text></GestureDetector>`)).toResemble(
      cls(`GestureDetector(onTap: () { f(); }, child: Text('x'))`),
    );
  });

  it('passes gestures through natively on InkWell (no GestureDetector wrap)', () => {
    expect(body(`<InkWell onTap={() => f()}><Text>x</Text></InkWell>`)).toResemble(
      cls(`InkWell(onTap: () { f(); }, child: Text('x'))`),
    );
  });

  it('wraps a self-closing widget that has no children', () => {
    expect(body(`<Icon name="home" onTap={() => f()} />`)).toResemble(
      cls(`GestureDetector(onTap: () { f(); }, child: Icon(name: 'home'))`),
    );
  });
});

describe('animate prop → Animated* twin', () => {
  it('swaps Container → AnimatedContainer and converts duration to Duration', () => {
    expect(body(`<Container animate duration={300} width={100}><Text>x</Text></Container>`)).toResemble(
      cls(`AnimatedContainer(duration: Duration(milliseconds: 300), width: 100, child: Text('x'))`),
    );
  });

  it('defaults duration to 300ms when omitted', () => {
    expect(body(`<Container animate width={100} />`)).toResemble(
      cls(`AnimatedContainer(width: 100, duration: Duration(milliseconds: 300))`),
    );
  });

  it('maps a curve string to Curves.<name>', () => {
    expect(body(`<Container animate duration={200} curve="easeInOut" />`)).toResemble(
      cls(`AnimatedContainer(duration: Duration(milliseconds: 200), curve: Curves.easeInOut)`),
    );
  });

  it('swaps Opacity → AnimatedOpacity', () => {
    expect(body(`<Opacity animate opacity={0.5}><Text>x</Text></Opacity>`)).toResemble(
      cls(`AnimatedOpacity(opacity: 0.5, duration: Duration(milliseconds: 300), child: Text('x'))`),
    );
  });

  it('converts color names inside a ternary (animated color)', () => {
    expect(body(`<Container animate color={open ? 'blue' : 'grey'}><Text>x</Text></Container>`)).toResemble(
      cls(`AnimatedContainer(color: open ? Colors.blue : Colors.grey, duration: Duration(milliseconds: 300), child: Text('x'))`),
    );
  });

  it('throws a helpful error when the widget has no Animated twin', () => {
    expect(() => body(`<Row animate><Text>x</Text></Row>`)).toThrow(
      /animate.*not supported on <Row>/,
    );
  });
});

describe('animate + gesture combined', () => {
  it('wraps the Animated widget in a GestureDetector', () => {
    expect(
      body(`<Container animate duration={100} onTap={() => f()}><Text>x</Text></Container>`),
    ).toResemble(
      cls(`GestureDetector(onTap: () { f(); }, child: AnimatedContainer(duration: Duration(milliseconds: 100), child: Text('x')))`),
    );
  });
});
