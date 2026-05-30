export const useState = <T>(
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] => {
  let state = initial;
  const setState = (value: T | ((prev: T) => T)): void => {
    if (typeof value === 'function') {
      state = (value as (prev: T) => T)(state);
    } else {
      state = value;
    }
  };
  return [state, setState];
};

export const useEffect = (
  effect: () => (() => void) | undefined,
  deps?: unknown[],
): void => {
  void effect;
  void deps;
};

/**
 * Returns a translation function `t(key)` resolving a key from the project's
 * `locales/*.json`. The transpiler generates a Dart `lib/l10n.dart` with a
 * global `t(key)` and imports it into files that use this hook.
 *
 * ```tsx
 * const t = useTranslations();
 * <Text>{t('app.title')}</Text>
 * ```
 */
export const useTranslations =
  (): ((key: string) => string) =>
  (key: string): string =>
    key;
