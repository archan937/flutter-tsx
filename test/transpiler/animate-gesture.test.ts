import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const body = (src: string): string => {
  const { sourceFile, exports } = parseSource(src);
  const out = generateDartFile(sourceFile, exports);
  // Drop the generated header (comment + ignores + import + blank).
  return out.split('\n').slice(4).join('\n').trim();
};

const wrap = (jsx: string): string =>
  `export function App() { return ${jsx}; }`;

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

describe('gesture props on any widget', () => {
  it('auto-wraps a non-gesture widget in GestureDetector for onTap', () => {
    const out = body(
      wrap(`<Container onTap={() => select(1)}><Text>hi</Text></Container>`),
    );
    expect(out).toContain('GestureDetector(onTap:');
    expect(out).toContain('child: Container(');
    expect(out).not.toContain('Container(onTap');
  });

  it('supports onLongPress and onDoubleTap', () => {
    const out = body(
      wrap(
        `<Container onLongPress={() => a()} onDoubleTap={() => b()}><Text>x</Text></Container>`,
      ),
    );
    expect(out).toContain('GestureDetector(');
    expect(out).toContain('onLongPress:');
    expect(out).toContain('onDoubleTap:');
  });

  it('passes gestures through natively (no double-wrap) on GestureDetector', () => {
    const out = body(
      wrap(
        `<GestureDetector onTap={() => f()}><Text>x</Text></GestureDetector>`,
      ),
    );
    expect(count(out, 'GestureDetector(')).toBe(1);
    expect(out).toContain('GestureDetector(onTap:');
  });

  it('passes gestures through natively on InkWell (no GestureDetector wrap)', () => {
    const out = body(
      wrap(`<InkWell onTap={() => f()}><Text>x</Text></InkWell>`),
    );
    expect(out).toContain('InkWell(onTap:');
    expect(out).not.toContain('GestureDetector(');
  });

  it('wraps a self-closing widget that has no children', () => {
    const out = body(wrap(`<Icon name="home" onTap={() => f()} />`));
    expect(out).toContain('GestureDetector(onTap:');
    expect(out).toContain('child: Icon(');
  });
});

describe('animate prop → Animated* twin', () => {
  it('swaps Container → AnimatedContainer and converts duration to Duration', () => {
    const out = body(
      wrap(
        `<Container animate duration={300} width={100}><Text>x</Text></Container>`,
      ),
    );
    expect(out).toContain('AnimatedContainer(');
    expect(out).toContain('duration: Duration(milliseconds: 300)');
    expect(out).not.toContain('animate:');
    expect(out).not.toContain('Container(animate');
  });

  it('defaults duration to 300ms when omitted', () => {
    const out = body(wrap(`<Container animate width={100} />`));
    expect(out).toContain('AnimatedContainer(');
    expect(out).toContain('duration: Duration(milliseconds: 300)');
  });

  it('maps a curve string to Curves.<name>', () => {
    const out = body(
      wrap(`<Container animate duration={200} curve="easeInOut" />`),
    );
    expect(out).toContain('curve: Curves.easeInOut');
  });

  it('swaps Opacity → AnimatedOpacity', () => {
    const out = body(
      wrap(`<Opacity animate opacity={0.5}><Text>x</Text></Opacity>`),
    );
    expect(out).toContain('AnimatedOpacity(');
    expect(out).not.toContain('animate:');
  });

  it('converts color names inside a ternary (animated color)', () => {
    const out = body(
      wrap(
        `<Container animate color={open ? 'blue' : 'grey'}><Text>x</Text></Container>`,
      ),
    );
    expect(out).toContain('color: open ? Colors.blue : Colors.grey');
  });

  it('throws a helpful error when the widget has no Animated twin', () => {
    expect(() => body(wrap(`<Row animate><Text>x</Text></Row>`))).toThrow(
      /animate.*not supported on <Row>/,
    );
  });
});

describe('animate + gesture combined', () => {
  it('wraps the Animated widget in a GestureDetector', () => {
    const out = body(
      wrap(
        `<Container animate duration={100} onTap={() => f()}><Text>x</Text></Container>`,
      ),
    );
    expect(out).toContain('GestureDetector(onTap:');
    expect(out).toContain('child: AnimatedContainer(');
    expect(out).toContain('duration: Duration(milliseconds: 100)');
  });
});
