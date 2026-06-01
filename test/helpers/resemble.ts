import { expect } from 'bun:test';

declare module 'bun:test' {
  interface Matchers<T> {
    /**
     * Asserts two strings are equal after trimming each line (and collapsing
     * runs of blank lines), so generated Dart can be asserted in full against a
     * readable, indented template literal. Generated-Dart tests assert the
     * ENTIRE snippet with this — never a partial `toContain`.
     */
    toResemble(expected: string): T;
  }
}

const normalize = (s: string): string =>
  s
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n')
    .trim();

expect.extend({
  toResemble(received: unknown, expected: string) {
    const normReceived = normalize(String(received));
    const normExpected = normalize(expected);
    const pass = normReceived === normExpected;
    return {
      pass,
      message: (): string =>
        pass
          ? 'expected strings not to resemble each other'
          : [
              'expected strings to resemble each other',
              '',
              '--- received ---',
              normReceived,
              '--- expected ---',
              normExpected,
            ].join('\n'),
    };
  },
});
