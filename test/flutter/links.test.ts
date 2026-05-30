import { describe, expect, it } from 'bun:test';

import { normalizeLinks } from '@src/flutter/links.js';

describe('normalizeLinks', () => {
  it('returns null for an empty config', () => {
    expect(normalizeLinks({})).toBeNull();
  });

  it('accepts a valid scheme and domains', () => {
    expect(
      normalizeLinks({ scheme: 'myapp', domains: ['example.com'] }),
    ).toEqual({ scheme: 'myapp', domains: ['example.com'] });
  });

  it('drops a reserved/invalid scheme but keeps valid domains', () => {
    expect(
      normalizeLinks({ scheme: 'https', domains: ['example.com'] }),
    ).toEqual({ scheme: null, domains: ['example.com'] });
  });

  it('drops invalid domains and de-duplicates', () => {
    expect(
      normalizeLinks({
        scheme: 'myapp',
        domains: ['example.com', 'not a domain', 'example.com'],
      }),
    ).toEqual({ scheme: 'myapp', domains: ['example.com'] });
  });

  it('returns null when nothing valid remains', () => {
    expect(
      normalizeLinks({ scheme: 'http', domains: ['bad domain'] }),
    ).toBeNull();
  });
});
