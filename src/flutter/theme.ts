import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';

export interface ThemeColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  error?: string;
  background?: string;
  surface?: string;
}

export interface ProjectTheme {
  light: ThemeColors;
  dark?: ThemeColors;
}

const VALID_KEYS = new Set<keyof ThemeColors>([
  'primary',
  'secondary',
  'tertiary',
  'error',
  'background',
  'surface',
]);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type ParsedTomlSection = Record<string, string>;

interface ParsedToml {
  root: ParsedTomlSection;
  sections: Record<string, ParsedTomlSection>;
}

const parseTomlMinimal = (content: string): ParsedToml => {
  const root: ParsedTomlSection = {};
  const sections: Record<string, ParsedTomlSection> = {};
  let current: ParsedTomlSection = root;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      const name = sectionMatch[1];
      sections[name] = {};
      current = sections[name];
      continue;
    }

    const kvMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"$/.exec(line);
    if (kvMatch) {
      current[kvMatch[1]] = kvMatch[2];
    }
  }

  return { root, sections };
};

const validateColor = (
  key: string,
  value: string,
): { ok: boolean; error?: string } => {
  if (!HEX_RE.test(value)) {
    return {
      ok: false,
      error: `theme.toml: ${key} must be a 7-char hex color (e.g. "#54a4ff"), got "${value}"`,
    };
  }
  return { ok: true };
};

const extractColors = (
  section: ParsedTomlSection,
  scope: string,
): ThemeColors | null => {
  const result: ThemeColors = {};
  let hadError = false;
  for (const [key, value] of Object.entries(section)) {
    if (!VALID_KEYS.has(key as keyof ThemeColors)) {
      logger.warn(`theme.toml [${scope}]: unknown key "${key}" ignored`);
      continue;
    }
    const validation = validateColor(`[${scope}] ${key}`, value);
    if (!validation.ok) {
      logger.error(validation.error ?? `theme.toml invalid color: ${key}`);
      hadError = true;
      continue;
    }
    result[key as keyof ThemeColors] = value;
  }
  if (hadError) return null;
  return result;
};

export const loadTheme = (projectRoot: string): ProjectTheme | null => {
  const path = join(projectRoot, 'theme.toml');
  if (!existsSync(path)) return null;

  const content = readFileSync(path, 'utf-8');
  const { root, sections } = parseTomlMinimal(content);

  const light = extractColors(root, 'light');
  if (light === null) return null;

  if (Object.keys(light).length === 0 && !sections['dark']) {
    return null;
  }

  const theme: ProjectTheme = { light };

  if (sections['dark']) {
    const dark = extractColors(sections['dark'], 'dark');
    if (dark === null) return null;
    theme.dark = dark;
  }

  return theme;
};

const hexToDartColor = (hex: string): string => {
  const stripped = hex.slice(1); // strip '#'
  return `Color(0xFF${stripped})`;
};

const buildColorScheme = (colors: ThemeColors, brightness: string): string => {
  const setKeys = Object.keys(colors) as (keyof ThemeColors)[];
  const seedKey = colors.primary;

  if (setKeys.length === 1 && seedKey) {
    return `ColorScheme.fromSeed(seedColor: ${hexToDartColor(seedKey)}, brightness: Brightness.${brightness})`;
  }

  const lines: string[] = [`ColorScheme(`];
  lines.push(`  brightness: Brightness.${brightness},`);
  for (const key of setKeys) {
    const value = colors[key];
    if (value) {
      lines.push(`  ${key}: ${hexToDartColor(value)},`);
    }
  }
  lines.push(`)`);
  return lines.join('\n');
};

export const themeToDart = (theme: ProjectTheme | null): string => {
  if (theme === null) return '';

  const lightScheme = buildColorScheme(theme.light, 'light');
  const lines: string[] = [];
  lines.push(`ThemeData(colorScheme: ${lightScheme})`);

  if (theme.dark) {
    const darkScheme = buildColorScheme(theme.dark, 'dark');
    lines.push(`ThemeData(colorScheme: ${darkScheme})`);
  }

  return lines.join('\n');
};
