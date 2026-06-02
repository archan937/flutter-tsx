import { describe, expect, it } from 'bun:test';

import { createStore } from '@src/core/hooks.js';

// Regression guard (compile-time): with an explicit state type, `set((s) => …)`
// sees `s: State` and the returned hook is typed (not `{}`). TS can't infer a
// store's shape when actions read state, so `createStore<State>(...)` is the
// supported, type-safe form (every scaffold uses it). The typed assignments
// below fail `bun run typecheck` if store typing regresses.
interface StatsState {
  count: number;
  label: string;
  bump: () => void;
}
describe('createStore type inference', () => {
  it('types state + actions from the explicit state type', () => {
    const useStats = createStore<StatsState>((set) => ({
      count: 0,
      label: 'clicks',
      bump: (): void =>
        set((s): Partial<StatsState> => ({ count: s.count + 1 })),
    }));

    const store = useStats();
    // Compile-time assertions: these are typed, not `{}`/`any`.
    const count: number = store.count;
    const label: string = store.label;
    const bump: () => void = store.bump;

    expect(count).toBe(0);
    expect(label).toBe('clicks');
    expect(typeof bump).toBe('function');
  });
});
