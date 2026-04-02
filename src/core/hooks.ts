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
