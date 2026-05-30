import { describe, expect, it } from 'bun:test';

import type { AppBarProps } from '@src/generated/widget-interfaces.js';

// Regression guard: `<AppBar title="My App" />` is the README's canonical
// example, and the transpiler wraps a string assigned to a Widget-typed prop in
// `Text(...)`. So `title` must (a) EXIST on AppBarProps (it's the default child
// slot, previously dropped from the typed props) and (b) accept a `string`
// convenience, not just a FlutterElement. These are compile-time assertions: if
// the generated types regress, `bun run typecheck` fails here.
describe('AppBarProps', () => {
  it('accepts a string `title` (string → Text convenience)', () => {
    const props: AppBarProps = { title: 'My App' };
    expect(props.title).toBe('My App');
  });
});
