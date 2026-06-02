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

  it('accepts mixed text + interpolation children (array form)', () => {
    // `<Text>Clicks: {count}</Text>` → children `['Clicks: ', count]`. Must be
    // a valid array (children?: TextContent | TextContent[]); compile-time
    // assertion — if Text children narrows back to `string | number`, `tsc`
    // fails here (the bug that broke ~12 scaffolds).
    const n = 3;
    const props: TextProps = { children: ['Clicks: ', n] };
    expect(props.children).toEqual(['Clicks: ', 3]);
  });
});
