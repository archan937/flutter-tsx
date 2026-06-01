import { describe, expect, it } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { formatDartDir, formatDartSource } from '@src/flutter/format.js';

const HAS_DART = existsSync(join(homedir(), '.fsx/flutter/bin/dart'));

describe('formatDartSource', () => {
  it('returns the input unchanged when no dart binary is available', async () => {
    if (HAS_DART) return; // covered by the formatting test below
    const src = 'class A{int x=0;}';
    expect(await formatDartSource(src)).toBe(src);
  });

  it.skipIf(!HAS_DART)('formats a Dart snippet via dart format', async () => {
    const messy =
      'class A{final int x=0;A(this.x);void m(){if(x>0){print(x);}}}';
    expect(await formatDartSource(messy)).toBe(
      [
        'class A {',
        '  final int x = 0;',
        '  A(this.x);',
        '  void m() {',
        '    if (x > 0) {',
        '      print(x);',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
  });
});

describe('formatDartDir', () => {
  it.skipIf(!HAS_DART)(
    'formats every .dart file in a directory in place',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'fmtdir-'));
      try {
        const file = join(dir, 'a.dart');
        writeFileSync(file, 'void main(){print(1);}');
        expect(await formatDartDir(dir)).toBe(true);
        expect(readFileSync(file, 'utf-8')).toBe(
          'void main() {\n  print(1);\n}\n',
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('is a no-op (false) for a missing directory', async () => {
    expect(await formatDartDir(join(tmpdir(), 'does-not-exist-fsx'))).toBe(
      false,
    );
  });
});
