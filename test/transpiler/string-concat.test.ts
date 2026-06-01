import { describe, expect, it } from 'bun:test';

import { generateDartFile } from '@src/transpiler/codegen.js';
import { parseSource } from '@src/transpiler/parser.js';
import '../helpers/resemble.js';

const dartFor = (jsx: string): string => {
  const src = `import { Text, ElevatedButton, useState } from 'flutter-tsx';
export function A() { const [n, setN] = useState(0); return ${jsx}; }`;
  const { sourceFile, exports } = parseSource(src);
  return generateDartFile(sourceFile, exports).split('\n').slice(2).join('\n');
};

const widget = (returnExpr: string): string => `
  import 'package:flutter/material.dart';

  class A extends StatefulWidget {
    const A({super.key});
    @override
    State<A> createState() => _AState();
  }
  class _AState extends State<A> {
    int n = 0;
    @override
    Widget build(BuildContext context) {
      return ${returnExpr};
    }
  }`;

describe('string + value concatenation → Dart interpolation (no String + int)', () => {
  it('Text child: prefix + int → interpolated string', () => {
    expect(dartFor(`<Text>{'Runs: ' + n}</Text>`)).toResemble(
      widget(`Text('Runs: $n')`),
    );
  });

  it('braces when an identifier char follows the value', () => {
    expect(dartFor(`<Text>{'a' + n + 'b'}</Text>`)).toResemble(
      widget(`Text('a\${n}b')`),
    );
  });

  it('no braces when whitespace follows', () => {
    expect(dartFor(`<Text>{'a ' + n + ' b'}</Text>`)).toResemble(
      widget(`Text('a $n b')`),
    );
  });

  it('non-Text child concat is wrapped in Text()', () => {
    expect(
      dartFor(`<ElevatedButton>{'Count: ' + n}</ElevatedButton>`),
    ).toResemble(widget(`ElevatedButton(child: Text('Count: $n'))`));
  });
});
