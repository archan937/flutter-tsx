import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '../cli/utils/logger.js';
import { GENERATED_IGNORES } from '../dart-lint.js';
import { dartString } from '../transpiler/dart-helpers.js';

export interface LocaleData {
  default: string;
  locales: Record<string, Record<string, string>>;
}

const DEFAULT_LOCALE = 'en';

const parseLocaleFile = (path: string): Record<string, string> | null => {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      logger.error(`locales: ${path} is not a JSON object`);
      return null;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') {
        logger.error(`locales: ${path} key "${key}" is not a string`);
        return null;
      }
      result[key] = value;
    }
    return result;
  } catch (err) {
    logger.error(`locales: failed to parse ${path}: ${String(err)}`);
    return null;
  }
};

export const loadLocales = (projectRoot: string): LocaleData | null => {
  const dir = join(projectRoot, 'locales');
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.includes(`${DEFAULT_LOCALE}.json`)) return null;

  const enData = parseLocaleFile(join(dir, `${DEFAULT_LOCALE}.json`));
  if (enData === null) return null;
  if (Object.keys(enData).length === 0) return null;

  const locales: Record<string, Record<string, string>> = { en: enData };
  const schemaKeys = new Set(Object.keys(enData));

  for (const file of files) {
    const code = file.slice(0, -'.json'.length);
    if (code === DEFAULT_LOCALE) continue;

    const data = parseLocaleFile(join(dir, file));
    if (data === null) continue;

    const trimmed: Record<string, string> = {};
    for (const key of schemaKeys) {
      if (!(key in data)) {
        logger.warn(`locales/${file}: missing key "${key}"`);
        continue;
      }
      trimmed[key] = data[key];
    }
    for (const key of Object.keys(data)) {
      if (!schemaKeys.has(key)) {
        logger.warn(`locales/${file}: extra key "${key}" dropped`);
      }
    }
    locales[code] = trimmed;
  }

  return { default: DEFAULT_LOCALE, locales };
};

const extractPlaceholders = (template: string): string[] => {
  const result: string[] = [];
  const re = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    if (!result.includes(match[1])) result.push(match[1]);
  }
  return result;
};

export const localesToArb = (
  locales: Record<string, Record<string, string>>,
): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [locale, entries] of Object.entries(locales)) {
    const obj: Record<string, unknown> = {};
    obj['@@locale'] = locale;

    const sortedKeys = Object.keys(entries).sort();
    for (const key of sortedKeys) {
      obj[key] = entries[key];
      const placeholders = extractPlaceholders(entries[key]);
      if (placeholders.length > 0) {
        const placeholderMap: Record<string, { type: string }> = {};
        for (const p of placeholders) placeholderMap[p] = { type: 'String' };
        obj[`@${key}`] = { placeholders: placeholderMap };
      }
    }

    result[locale] = JSON.stringify(obj, null, 2);
  }

  return result;
};

/**
 * Generates `lib/l10n.dart` — a self-contained translations table plus a global
 * `t(key)` resolver — from the project's locale files. Keys are arbitrary
 * strings (looked up at runtime), so they need not be valid Dart identifiers.
 * `t` falls back to the default locale, then the key itself.
 */
export const localesToL10nDart = (data: LocaleData): string => {
  const localeEntries = Object.entries(data.locales).map(([code, entries]) => {
    const pairs = Object.keys(entries)
      .sort()
      .map((key) => `    ${dartString(key)}: ${dartString(entries[key])},`)
      .join('\n');
    return `  ${dartString(code)}: {\n${pairs}\n  },`;
  });

  return [
    '// GENERATED — do not edit. Source: locales/',
    GENERATED_IGNORES,
    '',
    `String _fsxLocale = ${dartString(data.default)};`,
    '',
    '// ignore: unused_element',
    'void setLocale(String locale) => _fsxLocale = locale;',
    '',
    'const Map<String, Map<String, String>> _fsxTranslations = {',
    ...localeEntries,
    '};',
    '',
    'String t(String key) =>',
    `    _fsxTranslations[_fsxLocale]?[key] ??`,
    `    _fsxTranslations[${dartString(data.default)}]?[key] ??`,
    '    key;',
    '',
  ].join('\n');
};
