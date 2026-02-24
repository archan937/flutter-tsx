import { join, basename, dirname, relative } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { parseFile } from "./parser.js";
import { generateDartFile } from "./codegen.js";

/**
 * Transpiles a single TSX file to a Dart file.
 *
 * @param tsxPath  - Absolute path to the .tsx source file
 * @param outDir   - Absolute path to the Dart output directory (e.g. .fsx/flutter/lib)
 * @returns        - Path to the written .dart file
 */
export async function transpileFile(tsxPath: string, outDir: string): Promise<string> {
  const parsed = parseFile(tsxPath);

  if (parsed.exports.length === 0) {
    // No exported components — skip
    return "";
  }

  const dartCode = generateDartFile(parsed.sourceFile, parsed.exports);

  // Derive output path: src/App.tsx → lib/App.dart
  const inputBaseName = basename(tsxPath, ".tsx");
  const dartFileName = `${inputBaseName}.dart`;
  const dartPath = join(outDir, dartFileName);

  if (!existsSync(dirname(dartPath))) {
    mkdirSync(dirname(dartPath), { recursive: true });
  }

  writeFileSync(dartPath, dartCode, "utf-8");
  return dartPath;
}

/**
 * Transpiles all TSX files in a directory tree.
 *
 * @param srcDir - Source directory (e.g. ./src)
 * @param outDir - Output directory (e.g. .fsx/flutter/lib)
 */
export async function transpileAll(srcDir: string, outDir: string): Promise<string[]> {
  const glob = new Bun.Glob("**/*.tsx");
  const files = await Array.fromAsync(glob.scan({ cwd: srcDir }));

  const results = await Promise.allSettled(
    files.map((f) => transpileFile(join(srcDir, f), outDir))
  );

  const written: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      written.push(result.value);
    } else if (result.status === "rejected") {
      console.error("Transpile error:", result.reason);
    }
  }

  return written;
}
