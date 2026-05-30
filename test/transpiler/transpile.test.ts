import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { transpileAll, transpileFile } from '@src/transpiler/index.js';

const mkTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-transpile-'));

const writeSrc = (dir: string, rel: string, content: string): void => {
  const path = join(dir, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
};

describe('transpileFile', () => {
  it('returns an empty result for a file with no exported component', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'helpers.tsx', `const x = 1;\n`);
    const result = await transpileFile(
      join(src, 'helpers.tsx'),
      join(dir, 'out'),
    );
    expect(result.path).toBe('');
    expect(result.packages).toEqual([]);
  });

  it('collects pubspec packages from used plugin hooks', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'Cam.tsx',
      `import { useCamera } from 'flutter-tsx';\n` +
        `export const Cam = () => {\n` +
        `  const cam = useCamera();\n` +
        `  return <Center />;\n` +
        `};\n`,
    );
    const result = await transpileFile(join(src, 'Cam.tsx'), join(dir, 'out'));
    expect(result.packages.some((p) => p.startsWith('camera:'))).toBe(true);
  });

  it('infers permission capabilities from used plugin hooks', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(
      src,
      'Cam.tsx',
      `import { useCamera } from 'flutter-tsx';\n` +
        `export const Cam = () => {\n` +
        `  const cam = useCamera();\n` +
        `  return <Center />;\n` +
        `};\n`,
    );
    const result = await transpileFile(join(src, 'Cam.tsx'), join(dir, 'out'));
    expect(result.capabilities).toContain('camera');
  });
});

describe('transpileAll', () => {
  it('transpiles every .tsx in the source tree', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'App.tsx', `export const App = () => <Center />;\n`);
    writeSrc(
      src,
      'screens/Home.tsx',
      `export const Home = () => <Center />;\n`,
    );
    const results = await transpileAll(src, join(dir, 'out'));
    expect(results.length).toBe(2);
  });

  it('throws when a file fails to transpile (surfacing the error)', async () => {
    const dir = mkTmp();
    const src = join(dir, 'src');
    writeSrc(src, 'App.tsx', `export const App = () => <Center />;\n`);
    // outDir's parent is a FILE → mkdirSync fails inside transpileFile → rejected.
    const blocker = join(dir, 'blocker');
    writeFileSync(blocker, 'not a dir', 'utf-8');
    await expect(transpileAll(src, join(blocker, 'out'))).rejects.toThrow(
      /failed to transpile/,
    );
  });
});
