import { envToDartDefines } from '@src/flutter/env.js';
import { describe, expect, it } from 'bun:test';

describe('envToDartDefines', () => {
  it('returns [] for empty env', () => {
    expect(envToDartDefines({})).toEqual([]);
  });

  it('emits --dart-define=KEY=VALUE in alphabetical key order', () => {
    expect(envToDartDefines({ B: '2', A: '1' })).toEqual([
      '--dart-define=A=1',
      '--dart-define=B=2',
    ]);
  });

  it('preserves = in value', () => {
    expect(envToDartDefines({ URL: 'https://x?y=z' })).toEqual([
      '--dart-define=URL=https://x?y=z',
    ]);
  });
});
