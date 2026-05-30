import type { Theme, ThemeColors } from '../config.js';

// `ProjectTheme` is the internal alias for the public `Theme` type (defined
// canonically in config.ts so the developer-facing config and the codegen
// share one source of truth).
export type ProjectTheme = Theme;
export type { ThemeColors };

const hexToDartColor = (hex: string): string =>
  `Color(0xFF${hex.replace('#', '')})`;

const buildColorScheme = (colors: ThemeColors, brightness: string): string => {
  const setKeys = (Object.keys(colors) as (keyof ThemeColors)[]).filter(
    (k) => colors[k],
  );

  // A single color → seed the whole scheme from it (idiomatic Material 3).
  if (setKeys.length === 1 && colors.primary) {
    return `ColorScheme.fromSeed(seedColor: ${hexToDartColor(colors.primary)}, brightness: Brightness.${brightness})`;
  }

  const lines = [`ColorScheme(`, `  brightness: Brightness.${brightness},`];
  for (const key of setKeys) {
    lines.push(`  ${key}: ${hexToDartColor(colors[key] as string)},`);
  }
  lines.push(`)`);
  return lines.join('\n');
};

/**
 * Converts a typed `config/theme.ts` into the `MaterialApp` props to inject:
 * `{ theme, darkTheme? }` (each a `ThemeData(...)` Dart expression). The
 * codegen adds these to the user's `<MaterialApp>` when they haven't set them.
 */
export const themeToMaterialAppProps = (
  theme: Theme,
): { theme: string; darkTheme?: string } => {
  const result: { theme: string; darkTheme?: string } = {
    theme: `ThemeData(colorScheme: ${buildColorScheme(theme.light, 'light')})`,
  };
  if (theme.dark) {
    result.darkTheme = `ThemeData(colorScheme: ${buildColorScheme(theme.dark, 'dark')})`;
  }
  return result;
};
