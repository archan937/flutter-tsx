import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { resolveTrayIconSource } from '@src/flutter/project.js';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'fsx-tray-'));
const touch = (root: string, rel: string): string => {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, '');
  return p;
};

describe('resolveTrayIconSource', () => {
  it('prefers icons/tray.png when present', () => {
    const root = tmp();
    try {
      touch(root, 'icons/icon.png');
      const tray = touch(root, 'icons/tray.png');
      expect(resolveTrayIconSource(root)).toBe(tray);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to icons/icon.png when tray.png is absent', () => {
    const root = tmp();
    try {
      const icon = touch(root, 'icons/icon.png');
      expect(resolveTrayIconSource(root)).toBe(icon);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns null when neither icon exists', () => {
    const root = tmp();
    try {
      expect(resolveTrayIconSource(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
