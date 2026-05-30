import { describe, expect, it } from 'bun:test';

import type { TextProps } from '@src/generated/widget-interfaces.js';

// Regression guard: `<Text>hi</Text>` passes the string via JSX children, which
// the transpiler maps to Text's positional `data`. So `data` must be OPTIONAL
// in TextProps — otherwise every scaffolded app fails `tsc` on the most basic
// widget. This assignment is a compile-time assertion: if `data` becomes
// required again, `bun run typecheck` fails here.
describe('TextProps', () => {
  it('accepts children without an explicit `data` prop', () => {
    const props: TextProps = { children: 'hello' };
    expect(props.children).toBe('hello');
  });
});
