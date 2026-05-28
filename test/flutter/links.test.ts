import * as loggerModule from '@src/cli/utils/logger.js';
import { loadLinks } from '@src/flutter/links.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const makeTmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-links-test-'));

describe('loadLinks', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when links.toml missing', () => {
    expect(loadLinks(tmp)).toBeNull();
  });

  it('loads scheme only', () => {
    writeFileSync(join(tmp, 'links.toml'), 'scheme = "myapp"\n');
    const links = loadLinks(tmp);
    expect(links?.scheme).toBe('myapp');
    expect(links?.domains).toEqual([]);
  });

  it('loads domains only', () => {
    writeFileSync(join(tmp, 'links.toml'), 'domains = ["myapp.com"]\n');
    const links = loadLinks(tmp);
    expect(links?.scheme).toBeNull();
    expect(links?.domains).toEqual(['myapp.com']);
  });

  it('returns null + logs error on invalid scheme (contains ://)', () => {
    writeFileSync(join(tmp, 'links.toml'), 'scheme = "myapp://"\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns null on uppercase scheme', () => {
    writeFileSync(join(tmp, 'links.toml'), 'scheme = "MyApp"\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();
    errorSpy.mockRestore();
  });

  it('returns null on leading-digit scheme', () => {
    writeFileSync(join(tmp, 'links.toml'), 'scheme = "1app"\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();
    errorSpy.mockRestore();
  });

  it('returns null on reserved schemes http/https', () => {
    writeFileSync(join(tmp, 'links.toml'), 'scheme = "http"\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();

    writeFileSync(join(tmp, 'links.toml'), 'scheme = "https"\n');
    expect(loadLinks(tmp)).toBeNull();
    errorSpy.mockRestore();
  });

  it('drops invalid domains, keeps valid ones', () => {
    writeFileSync(
      join(tmp, 'links.toml'),
      'domains = ["myapp.com", "bad domain", "https://x"]\n',
    );
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    const links = loadLinks(tmp);
    expect(links?.domains).toEqual(['myapp.com']);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error on malformed domains TOML value', () => {
    writeFileSync(join(tmp, 'links.toml'), 'domains = not-an-array\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs error on malformed array element (missing quotes)', () => {
    writeFileSync(join(tmp, 'links.toml'), 'domains = [foo, bar]\n');
    const errorSpy = spyOn(loggerModule.logger, 'error').mockImplementation(
      ((..._args: unknown[]) => void _args) as never,
    );
    expect(loadLinks(tmp)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('deduplicates domain entries', () => {
    writeFileSync(
      join(tmp, 'links.toml'),
      'domains = ["myapp.com", "myapp.com"]\n',
    );
    const links = loadLinks(tmp);
    expect(links?.domains).toEqual(['myapp.com']);
  });
});
