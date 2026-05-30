import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import * as loggerModule from '@src/cli/utils/logger.js';
import {
  detectFonts,
  fontsToPubspecBlock,
  parseFontFilename,
} from '@src/flutter/fonts.js';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-fonts-test-'));

describe('parseFontFilename', () => {
  it('parses Inter-Regular.ttf → family Inter, weight 400, italic false', () => {
    expect(parseFontFilename('Inter-Regular.ttf')).toEqual({
      family: 'Inter',
      weight: 400,
      italic: false,
    });
  });

  it('parses Inter-ExtraBold.ttf → weight 800', () => {
    expect(parseFontFilename('Inter-ExtraBold.ttf')).toEqual({
      family: 'Inter',
      weight: 800,
      italic: false,
    });
  });

  it('parses JetBrainsMono-ExtraBoldItalic.ttf → family + 800 + italic', () => {
    expect(parseFontFilename('JetBrainsMono-ExtraBoldItalic.ttf')).toEqual({
      family: 'JetBrainsMono',
      weight: 800,
      italic: true,
    });
  });

  it('returns null + warns when filename has no dash separator', () => {
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(parseFontFilename('Inter.ttf')).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('returns null + warns on unknown weight token', () => {
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(parseFontFilename('Inter-Heavy.ttf')).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('parses filename without extension: Inter-Regular → still parses', () => {
    expect(parseFontFilename('Inter-Regular')).toEqual({
      family: 'Inter',
      weight: 400,
      italic: false,
    });
  });

  it('is case-sensitive on weight token: Inter-bold.ttf → null', () => {
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(parseFontFilename('Inter-bold.ttf')).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('detectFonts', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns {} when fonts/ missing', () => {
    expect(detectFonts(tmp)).toEqual({});
  });

  it('returns {} when fonts/ exists but is empty', () => {
    mkdirSync(join(tmp, 'fonts'));
    expect(detectFonts(tmp)).toEqual({});
  });

  it('groups multiple families with their entries', () => {
    mkdirSync(join(tmp, 'fonts'));
    writeFileSync(join(tmp, 'fonts', 'Inter-Regular.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'Inter-Bold.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'JetBrainsMono-Regular.ttf'), '');
    const fonts = detectFonts(tmp);
    expect(Object.keys(fonts).sort()).toEqual(['Inter', 'JetBrainsMono']);
    expect(fonts['Inter']).toHaveLength(2);
    expect(fonts['JetBrainsMono']).toHaveLength(1);
  });

  it('ignores non-font files', () => {
    mkdirSync(join(tmp, 'fonts'));
    writeFileSync(join(tmp, 'fonts', 'Inter-Regular.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'notes.txt'), '');
    writeFileSync(join(tmp, 'fonts', 'screenshot.png'), '');
    writeFileSync(join(tmp, 'fonts', '.DS_Store'), '');
    const fonts = detectFonts(tmp);
    expect(Object.keys(fonts)).toEqual(['Inter']);
  });

  it('accepts both .ttf and .otf', () => {
    mkdirSync(join(tmp, 'fonts'));
    writeFileSync(join(tmp, 'fonts', 'Inter-Regular.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'Inter-Bold.otf'), '');
    const fonts = detectFonts(tmp);
    expect(fonts['Inter']).toHaveLength(2);
  });

  it('ignores files without any extension', () => {
    mkdirSync(join(tmp, 'fonts'));
    writeFileSync(join(tmp, 'fonts', 'Inter-Regular.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'README'), '');
    const fonts = detectFonts(tmp);
    expect(Object.keys(fonts)).toEqual(['Inter']);
  });

  it('skips invalid files but continues with the rest', () => {
    mkdirSync(join(tmp, 'fonts'));
    writeFileSync(join(tmp, 'fonts', 'Inter.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'Inter-Heavy.ttf'), '');
    writeFileSync(join(tmp, 'fonts', 'Inter-Regular.ttf'), '');
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const fonts = detectFonts(tmp);
    expect(fonts['Inter']).toHaveLength(1);
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    warnSpy.mockRestore();
  });
});

describe('fontsToPubspecBlock', () => {
  it('returns empty string for empty map', () => {
    expect(fontsToPubspecBlock({})).toBe('');
  });

  it('emits families alphabetically with weights ascending', () => {
    const out = fontsToPubspecBlock({
      JetBrainsMono: [
        { weight: 400, italic: false, file: 'JetBrainsMono-Regular.ttf' },
      ],
      Inter: [
        { weight: 700, italic: false, file: 'Inter-Bold.ttf' },
        { weight: 400, italic: false, file: 'Inter-Regular.ttf' },
      ],
    });
    const lines = out.split('\n');
    const interIdx = lines.findIndex((l) => l.includes('family: Inter'));
    const jbIdx = lines.findIndex((l) => l.includes('family: JetBrainsMono'));
    expect(interIdx).toBeGreaterThan(-1);
    expect(jbIdx).toBeGreaterThan(interIdx);
    // Inter 400 should appear before Inter 700
    const w400 = lines.findIndex((l) => l.includes('weight: 400'));
    const w700 = lines.findIndex((l) => l.includes('weight: 700'));
    expect(w400).toBeLessThan(w700);
  });

  it('includes italic style when set', () => {
    const out = fontsToPubspecBlock({
      Inter: [{ weight: 700, italic: true, file: 'Inter-BoldItalic.ttf' }],
    });
    expect(out).toContain('style: italic');
  });
});
