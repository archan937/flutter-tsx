import * as loggerModule from '@src/cli/utils/logger.js';
import { loadLocales } from '@src/flutter/locales.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-locales-test-'));

describe('loadLocales', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when locales/ missing', () => {
    expect(loadLocales(tmp)).toBeNull();
  });

  it('returns null when en.json missing', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'nl.json'),
      JSON.stringify({ greeting: 'Hallo' }),
    );
    expect(loadLocales(tmp)).toBeNull();
  });

  it('returns null when en.json is empty {}', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(join(tmp, 'locales', 'en.json'), JSON.stringify({}));
    expect(loadLocales(tmp)).toBeNull();
  });

  it('loads a single en.json', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hi' }),
    );
    const data = loadLocales(tmp);
    expect(data?.default).toBe('en');
    expect(data?.locales['en']).toEqual({ greeting: 'Hi' });
  });

  it('loads en + nl + es', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hi' }),
    );
    writeFileSync(
      join(tmp, 'locales', 'nl.json'),
      JSON.stringify({ greeting: 'Hallo' }),
    );
    writeFileSync(
      join(tmp, 'locales', 'es.json'),
      JSON.stringify({ greeting: 'Hola' }),
    );
    const data = loadLocales(tmp);
    expect(Object.keys(data?.locales ?? {}).sort()).toEqual(['en', 'es', 'nl']);
  });

  it('warns when non-default locale is missing a key', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hi', farewell: 'Bye' }),
    );
    writeFileSync(
      join(tmp, 'locales', 'nl.json'),
      JSON.stringify({ greeting: 'Hallo' }),
    );
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    loadLocales(tmp);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns + drops extra keys in non-default locale', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hi' }),
    );
    writeFileSync(
      join(tmp, 'locales', 'nl.json'),
      JSON.stringify({ greeting: 'Hallo', extra: 'Bonus' }),
    );
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const data = loadLocales(tmp);
    expect(warnSpy).toHaveBeenCalled();
    expect(data?.locales['nl']['extra']).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('returns null when en.json is a JSON array (not an object)', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(join(tmp, 'locales', 'en.json'), '[]');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLocales(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns null when en.json has a non-string value', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ count: 42 }),
    );
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLocales(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error + drops malformed locale but keeps the rest', () => {
    mkdirSync(join(tmp, 'locales'));
    writeFileSync(
      join(tmp, 'locales', 'en.json'),
      JSON.stringify({ greeting: 'Hi' }),
    );
    writeFileSync(join(tmp, 'locales', 'nl.json'), '{ not json }');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const data = loadLocales(tmp);
    expect(errorSpy).toHaveBeenCalled();
    expect(data?.locales['nl']).toBeUndefined();
    expect(data?.locales['en']).toBeDefined();
    errorSpy.mockRestore();
  });
});
