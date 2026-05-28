import { localesToArb } from '@src/flutter/locales.js';
import { describe, expect, it } from 'bun:test';

describe('localesToArb', () => {
  it('emits a basic ARB file with @@locale metadata', () => {
    const out = localesToArb({ en: { greeting: 'Hi {name}' } });
    expect(out['en']).toBeDefined();
    const parsed = JSON.parse(out['en']) as Record<string, unknown>;
    expect(parsed['@@locale']).toBe('en');
    expect(parsed['greeting']).toBe('Hi {name}');
  });

  it('emits @key.placeholders metadata for placeholders', () => {
    const out = localesToArb({ en: { greeting: 'Hi {name}' } });
    const parsed = JSON.parse(out['en']) as Record<string, unknown>;
    const meta = parsed['@greeting'] as
      | { placeholders?: Record<string, unknown> }
      | undefined;
    expect(meta?.placeholders).toBeDefined();
    expect(meta?.placeholders?.['name']).toBeDefined();
  });

  it('is deterministic', () => {
    const out1 = localesToArb({ en: { greeting: 'Hi {name}' } });
    const out2 = localesToArb({ en: { greeting: 'Hi {name}' } });
    expect(out1['en']).toBe(out2['en']);
  });
});
