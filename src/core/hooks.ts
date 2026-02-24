/**
 * useState — stub for TypeScript type-checking.
 *
 * The transpiler analyzes calls to useState() in component functions to
 * generate StatefulWidget Dart code. At runtime in Flutter, state is managed
 * by Dart's setState() — this stub exists only for TSX type-checking.
 */
export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Runtime stub — actual state lives in Dart
  let state = initial;
  const setState = (value: T | ((prev: T) => T)) => {
    if (typeof value === "function") {
      state = (value as (prev: T) => T)(state);
    } else {
      state = value;
    }
  };
  return [state, setState];
}

/**
 * useEffect — stub for TypeScript type-checking.
 *
 * Analyzed by the transpiler to generate initState/dispose calls.
 */
export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  // Runtime stub
  void effect;
  void deps;
}
