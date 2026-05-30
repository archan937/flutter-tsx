import { describe, expect, it } from 'bun:test';

import { buildGoRouter, discoverRoutes } from '@src/transpiler/routing.js';

describe('discoverRoutes — file-based path mapping (Next/Expo convention)', () => {
  const paths = (files: string[]): Record<string, string> =>
    Object.fromEntries(discoverRoutes(files).map((r) => [r.file, r.path]));

  it('maps index.tsx to the segment root', () => {
    expect(paths(['index.tsx'])['index.tsx']).toBe('/');
    expect(paths(['users/index.tsx'])['users/index.tsx']).toBe('/users');
  });

  it('maps a static file to its path', () => {
    expect(paths(['about.tsx'])['about.tsx']).toBe('/about');
    expect(paths(['settings/theme.tsx'])['settings/theme.tsx']).toBe(
      '/settings/theme',
    );
  });

  it('maps [param] to :param', () => {
    expect(paths(['users/[id].tsx'])['users/[id].tsx']).toBe('/users/:id');
    expect(paths(['[slug].tsx'])['[slug].tsx']).toBe('/:slug');
  });

  it('ignores non-.tsx files', () => {
    const r = discoverRoutes(['index.tsx', 'README.md', 'helpers.ts', '.keep']);
    expect(r.map((x) => x.file)).toEqual(['index.tsx']);
  });

  it('returns a deterministic (sorted) order', () => {
    const a = discoverRoutes(['users/[id].tsx', 'about.tsx', 'index.tsx']);
    const b = discoverRoutes(['index.tsx', 'about.tsx', 'users/[id].tsx']);
    expect(a).toEqual(b);
  });
});

describe('buildGoRouter — GoRouter Dart codegen', () => {
  it('emits a GoRouter with a GoRoute per route', () => {
    const dart = buildGoRouter([
      { path: '/', component: 'Home' },
      { path: '/users/:id', component: 'User' },
    ]);
    expect(dart).toContain('final _fsxRouter = GoRouter(');
    expect(dart).toContain(
      "GoRoute(path: '/', builder: (context, state) => Home())",
    );
    expect(dart).toContain(
      "GoRoute(path: '/users/:id', builder: (context, state) => User())",
    );
  });

  it('handles a single route', () => {
    const dart = buildGoRouter([{ path: '/', component: 'App' }]);
    expect(dart).toContain(
      "GoRoute(path: '/', builder: (context, state) => App())",
    );
  });
});
