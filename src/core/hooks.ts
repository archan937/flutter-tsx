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

/**
 * Reads a route path parameter for the current screen (file-based routing).
 * `useParams('id')` on a `/users/[id]` route returns that segment's value. The
 * transpiler rewrites it to `GoRouterState.of(context).pathParameters['id']!`.
 *
 * ```tsx
 * const id = useParams('id');
 * <Text>{id}</Text>
 * ```
 */
export const useParams = (key: string): string => key;

/** The shape `useAsync` resolves to: the awaited value plus loading/error flags. */
export interface AsyncResult<T> {
  data: T;
  loading: boolean;
  error: unknown;
}

/**
 * Runs an async fetcher and exposes `{ data, loading, error }`. The transpiler
 * wraps the screen's returned tree in a Flutter `FutureBuilder<T>`: the loading
 * guard maps to the not-done connection state, the error guard to
 * `snapshot.hasError`, and `data` binds from `snapshot.data!`.
 *
 * ```tsx
 * const { data, loading, error } = useAsync(() => api.getUser(id));
 * if (loading) return <CircularProgressIndicator />;
 * if (error) return <Text>{error}</Text>;
 * return <Text>{data.name}</Text>;
 * ```
 */
export const useAsync = <T>(fetcher: () => Promise<T>): AsyncResult<T> => {
  void fetcher;
  return { data: undefined as T, loading: true, error: undefined };
};

/** Response shape for {@link fetch} — `json` is typed by fetch's `T` param. */
export interface FetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: string;
  json: T;
}

/**
 * HTTP GET helper for `useAsync`. The transpiler rewrites `fetch(url)` to a Dart
 * `http` call (`_fsxFetch`) returning `{ ok, status, body, json }`. Type the
 * decoded JSON with the generic: `useAsync(() => fetch<Post[]>(url))` → the
 * result's `data.json` is `Post[]`.
 */
export const fetch = <T = unknown>(url: string): Promise<FetchResponse<T>> => {
  void url;
  return Promise.resolve({
    ok: true,
    status: 200,
    body: '',
    json: undefined as T,
  });
};

type StoreSet<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

/**
 * Defines a shared store (Zustand-style): state + actions in one factory. The
 * transpiler generates a Flutter `ChangeNotifier` class (state → fields,
 * actions → methods calling `notifyListeners()`), wires it with `provider`, and
 * the returned hook resolves to `context.watch`/`context.read` in screens.
 *
 * Pass the state type explicitly — TypeScript can't infer a store's shape when
 * its actions read state via `set`/`get` (same limitation as Zustand's
 * `create<T>()`), so `createStore<State>(...)` is required for type-safe stores.
 *
 * ```tsx
 * type CounterState = { count: number; increment: () => void };
 * export const useCounter = createStore<CounterState>((set) => ({
 *   count: 0,
 *   increment: () => set((s) => ({ count: s.count + 1 })),
 * }));
 * // const { count, increment } = useCounter();
 * ```
 */
export const createStore = <T extends object>(
  factory: (set: StoreSet<T>, get: () => T) => T,
): (() => T) => {
  let state = {} as T;
  const set: StoreSet<T> = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...next };
  };
  state = factory(set, () => state);
  return () => state;
};

/** Subscribe to a store (optionally selecting a slice). */
export const useStore = <T, S = T>(
  store: () => T,
  selector?: (state: T) => S,
): S => {
  const state = store();
  return (selector ? selector(state) : state) as S;
};
