import { describe, expect, it } from 'bun:test';
import ts from 'typescript';

import {
  getFunctionBody,
  getReturnJSX,
  parseFile,
  parseSource,
} from './parser.js';

describe('parseSource', () => {
  it('parses a function declaration component', () => {
    const src = `
      export function Hello() {
        return <Text>hi</Text>;
      }
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('Hello');
    expect(exports[0].isArrow).toBe(false);
  });

  it('parses an arrow function component', () => {
    const src = `
      export const Greeting = () => <Text>hello</Text>;
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('Greeting');
    expect(exports[0].isArrow).toBe(true);
  });

  it('parses multiple exported components', () => {
    const src = `
      export function A() { return <Text>a</Text>; }
      export const B = () => <Text>b</Text>;
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(2);
    expect(exports.map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('ignores non-exported functions', () => {
    const src = `
      function Hidden() { return <Text>x</Text>; }
      export function Visible() { return <Text>y</Text>; }
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('Visible');
  });

  it('ignores non-function exports', () => {
    const src = `
      export const VALUE = 42;
      export function MyComp() { return <Text>hi</Text>; }
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('MyComp');
  });

  it('parses a function expression component', () => {
    const src = `
      export const Widget = function() { return <Text>hi</Text>; };
    `;
    const { exports } = parseSource(src);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('Widget');
    expect(exports[0].isArrow).toBe(false);
  });

  it('returns sourceFile with correct filename', () => {
    const { sourceFile } = parseSource('<div/>', 'test.tsx');
    expect(sourceFile.fileName).toBe('test.tsx');
  });

  it('returns empty exports for file with no exported components', () => {
    const { exports } = parseSource('const x = 1;');
    expect(exports).toHaveLength(0);
  });
});

describe('getFunctionBody', () => {
  it('returns a block body for a function declaration', () => {
    const { exports } = parseSource(`
      export function Comp() { return <Text>hi</Text>; }
    `);
    const body = getFunctionBody(exports[0].node);
    expect(body).not.toBeNull();
    if (!body) throw new Error('Expected body');
    expect(ts.isBlock(body)).toBe(true);
  });

  it('returns an expression body for a concise arrow function', () => {
    const { exports } = parseSource(`
      export const Comp = () => <Text>hi</Text>;
    `);
    const body = getFunctionBody(exports[0].node);
    expect(body).not.toBeNull();
    if (!body) throw new Error('Expected body');
    // Concise arrow body is the JSX expression directly, not a block
    expect(ts.isBlock(body)).toBe(false);
  });

  it('returns a block body for a block-body arrow function', () => {
    const { exports } = parseSource(`
      export const Comp = () => { return <Text>hi</Text>; };
    `);
    const body = getFunctionBody(exports[0].node);
    expect(body).not.toBeNull();
    if (!body) throw new Error('Expected body');
    expect(ts.isBlock(body)).toBe(true);
  });
});

describe('getReturnJSX', () => {
  it('returns the JSX element from a function with a return statement', () => {
    const { exports } = parseSource(`
      export function Comp() { return <Center />; }
    `);
    const jsx = getReturnJSX(exports[0].node);
    expect(jsx).not.toBeNull();
    if (!jsx) throw new Error('Expected JSX');
    expect(ts.isJsxSelfClosingElement(jsx)).toBe(true);
  });

  it('returns JSX from a concise arrow function', () => {
    const { exports } = parseSource(`
      export const Comp = () => <Text>hello</Text>;
    `);
    const jsx = getReturnJSX(exports[0].node);
    expect(jsx).not.toBeNull();
    if (!jsx) throw new Error('Expected JSX');
    expect(ts.isJsxElement(jsx)).toBe(true);
  });

  it('returns JSX from a parenthesized return', () => {
    const { exports } = parseSource(`
      export function Comp() {
        return (
          <Column>
            <Text>hi</Text>
          </Column>
        );
      }
    `);
    const jsx = getReturnJSX(exports[0].node);
    expect(jsx).not.toBeNull();
    if (!jsx) throw new Error('Expected JSX');
    expect(ts.isJsxElement(jsx)).toBe(true);
  });

  it('returns null for a function with no return', () => {
    const { exports } = parseSource(`
      export function Comp() { /* no return */ }
    `);
    expect(getReturnJSX(exports[0].node)).toBeNull();
  });

  it('returns a JsxFragment for a fragment root', () => {
    const { exports } = parseSource(`
      export const Comp = () => <><Text>a</Text><Text>b</Text></>;
    `);
    const jsx = getReturnJSX(exports[0].node);
    expect(jsx).not.toBeNull();
    if (!jsx) throw new Error('Expected JSX');
    expect(ts.isJsxFragment(jsx)).toBe(true);
  });

  it('returns null for a function that returns a non-JSX value', () => {
    const { exports } = parseSource(`
      export function Comp() { return 42; }
    `);
    expect(getReturnJSX(exports[0].node)).toBeNull();
  });
});

describe('parseFile', () => {
  it('parses a .tsx file from disk', async () => {
    const tmp = '/tmp/flutter-test-parseFile.tsx';
    await Bun.write(tmp, `export function Hello() { return <Text>hi</Text>; }`);
    const { exports } = parseFile(tmp);
    expect(exports).toHaveLength(1);
    expect(exports[0].name).toBe('Hello');
  });

  it('throws for a non-existent file', () => {
    expect(() => parseFile('/tmp/does-not-exist-flutter.tsx')).toThrow(
      'Could not parse file',
    );
  });
});
