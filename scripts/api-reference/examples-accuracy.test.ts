import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

import { CORE_APIS } from './render';

/**
 * The Native Plugins + Hooks & Core APIs sections show hand-authored tsx/dart
 * pairs (unlike the Examples gallery, which is transpiled). These guards keep the
 * hand-authored Dart honest: no placeholders, no leaked JS, and every TSX that
 * logs must show the Dart equivalent (debugPrint, never print()).
 */

interface Plugin {
  tsxName: string;
  tsxExample: string;
  dartExample: string;
}

const plugins: Plugin[] = JSON.parse(
  readFileSync(join(import.meta.dir, '../../ref/derived/plugins.json'), 'utf8'),
);

const pairs: { name: string; tsx: string; dart: string }[] = [
  ...plugins.map((p) => ({
    name: p.tsxName,
    tsx: p.tsxExample,
    dart: p.dartExample,
  })),
  ...CORE_APIS.map((a) => ({ name: a.name, tsx: a.tsx, dart: a.dart })),
];

const isCommentOnly = (dart: string): boolean =>
  dart
    .split('\n')
    .filter((l) => l.trim())
    .every((l) => l.trim().startsWith('//'));

describe('API-reference examples — hand-authored Dart is faithful', () => {
  for (const { name, tsx, dart } of pairs) {
    it(`${name}: Dart has no placeholder/leak`, () => {
      expect(dart.trim()).not.toBe('');
      expect(/\.\.\./.test(dart)).toBe(false); // unfinished placeholder
      expect(/console\.log/.test(dart)).toBe(false); // leaked JS
      expect(/\bprint\(/.test(dart)).toBe(false); // use debugPrint
      expect(isCommentOnly(dart)).toBe(false); // not a stub
    });

    it(`${name}: a TSX console.log is mirrored by debugPrint in Dart`, () => {
      if (/console\.log/.test(tsx)) {
        expect(/debugPrint/.test(dart)).toBe(true);
      }
    });
  }
});
