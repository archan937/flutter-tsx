/**
 * Build-time env → `--dart-define` flags.
 *
 * The developer declares env in a typed `config/env.ts` (`satisfies EnvConfig`),
 * which `fsx dev` loads via `loadSurfaceConfig` and passes here. Because it is
 * TypeScript, the config may read `process.env` for secrets and provide typed
 * defaults — no `.env` parsing of our own.
 */
export const envToDartDefines = (env: Record<string, string>): string[] => {
  const keys = Object.keys(env).sort();
  return keys.map((key) => `--dart-define=${key}=${env[key]}`);
};
