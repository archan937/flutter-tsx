import { describe, expect, it } from 'bun:test';

import { useEffect, useState } from './hooks.js';

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
