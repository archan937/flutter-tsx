import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

import { generateDartFile } from './codegen.js';
import { parseFile } from './parser.js';

export const transpileFile = async (
  tsxPath: string,
  outDir: string,
): Promise<string> => {
  const parsed = parseFile(tsxPath);

  if (parsed.exports.length === 0) {
    return '';
  }

  const dartCode = generateDartFile(parsed.sourceFile, parsed.exports);

  const inputBaseName = basename(tsxPath, '.tsx');
  const dartFileName = `${inputBaseName}.dart`;
  const dartPath = join(outDir, dartFileName);

  if (!existsSync(dirname(dartPath))) {
    mkdirSync(dirname(dartPath), { recursive: true });
  }

  writeFileSync(dartPath, dartCode, 'utf-8');
  return dartPath;
};

export const transpileAll = async (
  srcDir: string,
  outDir: string,
): Promise<string[]> => {
  const glob = new Bun.Glob('**/*.tsx');
  const files = await Array.fromAsync(glob.scan({ cwd: srcDir }));

  const results = await Promise.allSettled(
    files.map((f) => transpileFile(join(srcDir, f), outDir)),
  );

  const written: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      written.push(result.value);
    } else if (result.status === 'rejected') {
      console.error('Transpile error:', result.reason);
    }
  }

  return written;
};
