import * as loggerModule from '@src/cli/utils/logger.js';
import { detectLegal } from '@src/flutter/legal.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-legal-test-'));

describe('detectLegal', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns false flags when legal/ missing', () => {
    expect(detectLegal(tmp)).toEqual({ privacy: false, terms: false });
  });

  it('detects privacy.md only', () => {
    mkdirSync(join(tmp, 'legal'));
    writeFileSync(join(tmp, 'legal', 'privacy.md'), '# Privacy\nContent.');
    expect(detectLegal(tmp)).toEqual({ privacy: true, terms: false });
  });

  it('detects both privacy + terms', () => {
    mkdirSync(join(tmp, 'legal'));
    writeFileSync(join(tmp, 'legal', 'privacy.md'), '# Privacy');
    writeFileSync(join(tmp, 'legal', 'terms.md'), '# Terms');
    expect(detectLegal(tmp)).toEqual({ privacy: true, terms: true });
  });

  it('warns on empty markdown file but flag remains true', () => {
    mkdirSync(join(tmp, 'legal'));
    writeFileSync(join(tmp, 'legal', 'privacy.md'), '');
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(detectLegal(tmp).privacy).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores files other than privacy.md / terms.md', () => {
    mkdirSync(join(tmp, 'legal'));
    writeFileSync(join(tmp, 'legal', 'README.md'), '# README');
    writeFileSync(join(tmp, 'legal', 'misc.txt'), 'stuff');
    expect(detectLegal(tmp)).toEqual({ privacy: false, terms: false });
  });
});
