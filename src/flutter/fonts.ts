import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface FontEntry {
  weight: number;
  italic: boolean;
  file: string;
}

export type FontMap = Record<string, FontEntry[]>;

const WEIGHT_MAP: Record<string, number> = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
};

const FONT_EXTENSIONS = new Set(['.ttf', '.otf']);

export const parseFontFilename = (
  filename: string,
): { family: string; weight: number; italic: boolean } | null => {
  const dotIdx = filename.lastIndexOf('.');
  const stem = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
  const dashIdx = stem.indexOf('-');

  if (dashIdx < 0) {
    logger.warn(
      `font filename missing weight separator (expected Family-Weight.ttf): ${filename}`,
    );
    return null;
  }

  const family = stem.slice(0, dashIdx);
  let token = stem.slice(dashIdx + 1);
  let italic = false;

  if (token.endsWith('Italic')) {
    italic = true;
    token = token.slice(0, -'Italic'.length);
  }

  const weight = WEIGHT_MAP[token];
  if (weight === undefined) {
    logger.warn(
      `font filename has unknown weight token "${token}": ${filename}`,
    );
    return null;
  }

  return { family, weight, italic };
};

export const detectFonts = (projectRoot: string): FontMap => {
  const fontsDir = join(projectRoot, 'fonts');
  if (!existsSync(fontsDir)) return {};

  const result: FontMap = {};
  const entries = readdirSync(fontsDir);

  for (const filename of entries) {
    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx < 0) continue;
    const ext = filename.slice(dotIdx).toLowerCase();
    if (!FONT_EXTENSIONS.has(ext)) continue;

    const parsed = parseFontFilename(filename);
    if (!parsed) continue;

    const list = result[parsed.family] ?? [];
    list.push({ weight: parsed.weight, italic: parsed.italic, file: filename });
    result[parsed.family] = list;
  }

  return result;
};

export const fontsToPubspecBlock = (fonts: FontMap): string => {
  const families = Object.keys(fonts).sort();
  if (families.length === 0) return '';

  const lines: string[] = ['  fonts:'];
  for (const family of families) {
    const entries = [...fonts[family]].sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight;
      return Number(a.italic) - Number(b.italic);
    });
    lines.push(`    - family: ${family}`);
    lines.push(`      fonts:`);
    for (const entry of entries) {
      lines.push(`        - asset: .fsx-fonts/${entry.file}`);
      lines.push(`          weight: ${entry.weight}`);
      if (entry.italic) {
        lines.push(`          style: italic`);
      }
    }
  }
  return lines.join('\n') + '\n';
};
