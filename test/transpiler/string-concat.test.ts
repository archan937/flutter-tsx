import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';

const line = (jsx: string): string => {
  const src = `import { Text, ElevatedButton, useState } from 'flutter-tsx';
export function A() { const [n, setN] = useState(0); return ${jsx}; }`;
  const { sourceFile, exports } = parseSource(src);
  return (
    generateDartFile(sourceFile, exports)
      .split('\n')
      .find((l) => l.includes('return ')) ?? ''
  );
};

describe('string + value concatenation → Dart interpolation (no String + int)', () => {
  it('Text child: prefix + int → interpolated string', () => {
    expect(line(`<Text>{'Runs: ' + n}</Text>`)).toContain("Text('Runs: $n')");
  });

  it('braces when an identifier char follows the value', () => {
    expect(line(`<Text>{'a' + n + 'b'}</Text>`)).toContain("Text('a${n}b')");
  });

  it('no braces when whitespace follows', () => {
    expect(line(`<Text>{'a ' + n + ' b'}</Text>`)).toContain("Text('a $n b')");
  });

  it('non-Text child concat is wrapped in Text()', () => {
    expect(line(`<ElevatedButton>{'Count: ' + n}</ElevatedButton>`)).toContain(
      "child: Text('Count: $n')",
    );
  });

  it('never emits a raw String + int', () => {
    const out = line(`<Text>{'Runs: ' + n}</Text>`);
    expect(out).not.toContain("'Runs: ' + n");
    expect(out).not.toContain('"Runs: " + n');
  });
});
