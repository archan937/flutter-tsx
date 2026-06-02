import { describe, expect, it } from 'bun:test';

import {
  createStore,
  fetch,
  useAsync,
  useEffect,
  useParams,
  useState,
  useStore,
  useTranslations,
} from '@src/core/hooks.js';

describe('useState', () => {
  it('returns initial value and a setter', () => {
    const [value, setValue] = useState(0);
    expect(value).toBe(0);
    expect(typeof setValue).toBe('function');
  });

  it('works with string initial value', () => {
    const [value] = useState('hello');
    expect(value).toBe('hello');
  });

  it('works with object initial value', () => {
    const obj = { count: 0 };
    const [value] = useState(obj);
    expect(value).toBe(obj);
  });

  it('works with boolean initial value', () => {
    const [value] = useState(true);
    expect(value).toBe(true);
  });

  it('setter accepts direct value', () => {
    const [, setValue] = useState(0);
    expect(() => setValue(5)).not.toThrow();
  });

  it('setter accepts updater function', () => {
    const [, setValue] = useState(0);
    expect(() => setValue((prev) => prev + 1)).not.toThrow();
  });

  it('works with null initial value', () => {
    const [value] = useState<string | null>(null);
    expect(value).toBeNull();
  });

  it('works with array initial value', () => {
    const [value] = useState([1, 2, 3]);
    expect(value).toEqual([1, 2, 3]);
  });
});

describe('useEffect', () => {
  it('accepts an effect function without throwing', () => {
    expect(() => useEffect(() => undefined)).not.toThrow();
  });

  it('accepts effect with cleanup return', () => {
    const cleanup = (): void => undefined;
    expect(() => useEffect((): (() => void) => cleanup)).not.toThrow();
  });

  it('accepts dependency array', () => {
    expect(() => useEffect(() => undefined, [1, 'a'])).not.toThrow();
  });

  it('accepts empty dependency array', () => {
    expect(() => useEffect(() => undefined, [])).not.toThrow();
  });
});

interface Counter {
  count: number;
  increment: () => void;
  set5: () => void;
}

describe('createStore', () => {
  const make = (): (() => Counter) =>
    createStore<Counter>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })), // function updater
      set5: () => set({ count: 5 }), // partial object
    }));

  it('exposes initial state + actions via the returned hook', () => {
    const store = make()();
    expect(store.count).toBe(0);
    expect(typeof store.increment).toBe('function');
  });

  it('set() with a function updater merges state', () => {
    const useC = make();
    useC().increment();
    expect(useC().count).toBe(1);
  });

  it('set() with a partial object merges state', () => {
    const useC = make();
    useC().set5();
    expect(useC().count).toBe(5);
  });
});

describe('useStore', () => {
  const useC = createStore<{ a: number; b: number }>(() => ({ a: 1, b: 2 }));

  it('returns the full state without a selector', () => {
    expect(useStore(useC).a).toBe(1);
  });

  it('applies a selector', () => {
    expect(useStore(useC, (s) => s.b)).toBe(2);
  });
});

describe('useAsync stub', () => {
  it('returns a loading result with the documented shape', () => {
    const result = useAsync(() => Promise.resolve(42));
    expect(result.loading).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.data).toBeUndefined();
  });
});

describe('fetch stub', () => {
  it('resolves the documented FetchResponse shape', async () => {
    const res = await fetch<number[]>('https://example.com/x');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.body).toBe('');
  });
});

describe('useParams / useTranslations stubs', () => {
  it('useParams echoes the key', () => {
    expect(useParams('id')).toBe('id');
  });

  it('useTranslations returns a t() that echoes the key', () => {
    expect(useTranslations()('app.title')).toBe('app.title');
  });
});
