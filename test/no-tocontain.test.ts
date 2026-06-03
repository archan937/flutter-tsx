import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guard: `toContain`/`toContainEqual` are banned in the test suite — they are
 * weak (a substring can pass while the surrounding generated output is wrong).
 * Assert generated snippets in full with `toResemble`, and arrays/scalars with
 * `toEqual`/`toBe`. This meta-test fails if any sneak back in.
 */
describe('no weak toContain assertions', () => {
  it('the test suite contains zero toContain/toContainEqual', async () => {
    const testDir = import.meta.dir;
    const self = 'no-tocontain.test.ts';
    const offenders: string[] = [];

    const files = await Array.fromAsync(
      new Bun.Glob('**/*.test.ts').scan({ cwd: testDir }),
    );
    for (const file of files) {
      if (file.endsWith(self)) continue;
      const source = readFileSync(join(testDir, file), 'utf-8');
      if (/\.toContain(Equal)?\(/.test(source)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});
