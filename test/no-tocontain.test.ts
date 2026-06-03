import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guard: `toContain`/`toContainEqual` are banned across EVERY test in the repo
 * (not just test/ — also scripts/**), because they are weak: a substring can
 * pass while the surrounding generated output is wrong. Assert generated
 * snippets in full with `toResemble`, arrays/objects with `toEqual`, scalars
 * with `toBe`, and forbidden-substring guards with a regex `.test()`. This
 * meta-test fails if any sneak back in.
 */
describe('no weak toContain assertions', () => {
  it('every *.test.ts in the repo is free of toContain/toContainEqual', async () => {
    const repoRoot = join(import.meta.dir, '..');
    const self = 'no-tocontain.test.ts';
    const offenders: string[] = [];

    const files = await Array.fromAsync(
      new Bun.Glob('**/*.test.ts').scan({ cwd: repoRoot }),
    );
    for (const file of files) {
      if (file.includes('node_modules') || file.startsWith('dist/')) continue;
      if (file.endsWith(self)) continue;
      const source = readFileSync(join(repoRoot, file), 'utf-8');
      if (/\.toContain(Equal)?\(/.test(source)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});
