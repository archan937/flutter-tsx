/**
 * File-based routing (Next/Expo convention) → go_router codegen.
 *
 * The `src/routes/` tree is the route map: `index.tsx` → `/`, `about.tsx` →
 * `/about`, `users/[id].tsx` → `/users/:id`, nested dirs nest. Pure functions
 * here (path mapping + Dart emission); the directory scan + per-file component
 * resolution live in the transpiler index.
 */

/** A discovered route file: its URL path + the source file (relative to routes/). */
export interface RouteFile {
  path: string;
  file: string;
}

/** A route ready for codegen: URL path + the Dart widget class to build. */
export interface RouteDef {
  path: string;
  component: string;
}

const filePathToRoute = (file: string): string => {
  const segments = file
    .replace(/\.tsx$/, '')
    .split('/')
    .filter((s) => s !== 'index') // index = segment root
    .map((s) => s.replace(/^\[(.+)\]$/, ':$1')); // [param] → :param
  return '/' + segments.join('/');
};

/**
 * Maps a list of `src/routes/`-relative file paths to URL routes. Ignores
 * non-`.tsx` files; output is sorted for deterministic codegen.
 */
export const discoverRoutes = (files: string[]): RouteFile[] =>
  files
    .filter((f) => f.endsWith('.tsx'))
    .map((file) => ({ path: filePathToRoute(file), file }))
    .sort((a, b) => a.path.localeCompare(b.path));

/** Emits the top-level `_fsxRouter` GoRouter declaration from resolved routes. */
export const buildGoRouter = (routes: RouteDef[]): string => {
  const goRoutes = routes
    .map(
      (r) =>
        `    GoRoute(path: '${r.path}', builder: (context, state) => ${r.component}()),`,
    )
    .join('\n');
  return `final _fsxRouter = GoRouter(\n  routes: [\n${goRoutes}\n  ],\n);`;
};
