import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import * as loggerModule from '@src/cli/utils/logger.js';
import { loadTheme, themeToDart } from '@src/flutter/theme.js';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-theme-test-'));

describe('loadTheme', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when theme.toml is missing', () => {
    expect(loadTheme(tmp)).toBeNull();
  });

  it('returns null when theme.toml is empty', () => {
    writeFileSync(join(tmp, 'theme.toml'), '');
    expect(loadTheme(tmp)).toBeNull();
  });

  it('loads a primary-only theme into light scheme', () => {
    writeFileSync(join(tmp, 'theme.toml'), 'primary = "#54a4ff"\n');
    const theme = loadTheme(tmp);
    expect(theme).not.toBeNull();
    expect(theme?.light.primary).toBe('#54a4ff');
  });

  it('loads a full palette into light scheme', () => {
    const toml = [
      'primary = "#54a4ff"',
      'secondary = "#a0d8ff"',
      'tertiary = "#ffce54"',
      'error = "#ff6b6b"',
      'background = "#ffffff"',
      'surface = "#f5f5f5"',
    ].join('\n');
    writeFileSync(join(tmp, 'theme.toml'), toml + '\n');
    const theme = loadTheme(tmp);
    expect(theme?.light.primary).toBe('#54a4ff');
    expect(theme?.light.secondary).toBe('#a0d8ff');
    expect(theme?.light.tertiary).toBe('#ffce54');
    expect(theme?.light.error).toBe('#ff6b6b');
    expect(theme?.light.background).toBe('#ffffff');
    expect(theme?.light.surface).toBe('#f5f5f5');
  });

  it('parses a [dark] section with background only', () => {
    const toml = [
      'primary = "#54a4ff"',
      '',
      '[dark]',
      'background = "#101820"',
    ].join('\n');
    writeFileSync(join(tmp, 'theme.toml'), toml + '\n');
    const theme = loadTheme(tmp);
    expect(theme?.light.primary).toBe('#54a4ff');
    expect(theme?.dark?.background).toBe('#101820');
  });

  it('returns null + logs error when primary hex is invalid', () => {
    writeFileSync(join(tmp, 'theme.toml'), 'primary = "red"\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadTheme(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('warns on unknown key but loads the rest', () => {
    const toml = ['primary = "#54a4ff"', 'accent = "#123456"'].join('\n');
    writeFileSync(join(tmp, 'theme.toml'), toml + '\n');
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const theme = loadTheme(tmp);
    expect(warnSpy).toHaveBeenCalled();
    expect(theme?.light.primary).toBe('#54a4ff');
    warnSpy.mockRestore();
  });
});

describe('themeToDart', () => {
  it('returns empty string for null', () => {
    expect(themeToDart(null)).toBe('');
  });

  it('emits ColorScheme.fromSeed for primary-only theme', () => {
    const dart = themeToDart({ light: { primary: '#54a4ff' } });
    expect(dart).toContain('ColorScheme.fromSeed');
    expect(dart).toContain('0xFF54a4ff');
  });

  it('is deterministic (snapshot)', () => {
    const dart1 = themeToDart({ light: { primary: '#54a4ff' } });
    const dart2 = themeToDart({ light: { primary: '#54a4ff' } });
    expect(dart1).toBe(dart2);
  });

  it('emits dark scheme block when theme.dark is provided', () => {
    const dart = themeToDart({
      light: { primary: '#54a4ff' },
      dark: { primary: '#101820' },
    });
    expect(dart).toContain('ColorScheme.fromSeed');
    expect(dart).toContain('Brightness.dark');
  });

  it('emits full ColorScheme when multiple colors are set', () => {
    const dart = themeToDart({
      light: {
        primary: '#54a4ff',
        secondary: '#a0d8ff',
        background: '#ffffff',
      },
    });
    expect(dart).toContain('primary: Color(0xFF54a4ff)');
    expect(dart).toContain('secondary: Color(0xFFa0d8ff)');
  });
});
