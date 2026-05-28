import * as loggerModule from '@src/cli/utils/logger.js';
import { loadEnv } from '@src/flutter/env.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-env-test-'));

describe('loadEnv', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns {} when no .env file present', () => {
    expect(loadEnv(tmp, 'development')).toEqual({});
  });

  it('loads .env values', () => {
    writeFileSync(join(tmp, '.env'), 'API_URL=https://example.com\n');
    expect(loadEnv(tmp, 'development')).toEqual({
      API_URL: 'https://example.com',
    });
  });

  it('overlays .env.production when mode=production', () => {
    writeFileSync(join(tmp, '.env'), 'API_URL=https://dev.example.com\n');
    writeFileSync(
      join(tmp, '.env.production'),
      'API_URL=https://prod.example.com\n',
    );
    expect(loadEnv(tmp, 'production')).toEqual({
      API_URL: 'https://prod.example.com',
    });
  });

  it('does NOT read .env.production when mode=development', () => {
    writeFileSync(join(tmp, '.env'), 'API_URL=dev\n');
    writeFileSync(join(tmp, '.env.production'), 'API_URL=prod\n');
    expect(loadEnv(tmp, 'development')).toEqual({ API_URL: 'dev' });
  });

  it('ignores comments and blank lines', () => {
    writeFileSync(
      join(tmp, '.env'),
      ['# comment', '', 'API=1', '# another'].join('\n') + '\n',
    );
    expect(loadEnv(tmp, 'development')).toEqual({ API: '1' });
  });

  it('strips outer double-quotes', () => {
    writeFileSync(join(tmp, '.env'), 'X="hello world"\n');
    expect(loadEnv(tmp, 'development')).toEqual({ X: 'hello world' });
  });

  it('preserves = inside values', () => {
    writeFileSync(join(tmp, '.env'), 'URL=https://x?y=z\n');
    expect(loadEnv(tmp, 'development')).toEqual({ URL: 'https://x?y=z' });
  });

  it('handles empty values', () => {
    writeFileSync(join(tmp, '.env'), 'X=\n');
    expect(loadEnv(tmp, 'development')).toEqual({ X: '' });
  });

  it('strips outer single-quotes', () => {
    writeFileSync(join(tmp, '.env'), "X='hi there'\n");
    expect(loadEnv(tmp, 'development')).toEqual({ X: 'hi there' });
  });

  it('warns + skips malformed lines (no =)', () => {
    writeFileSync(join(tmp, '.env'), 'GOOD=1\nbrokenline\n');
    const warnSpy = spyOn(loggerModule.logger, 'warn').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const env = loadEnv(tmp, 'development');
    expect(env).toEqual({ GOOD: '1' });
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('brokenline');
    warnSpy.mockRestore();
  });
});
