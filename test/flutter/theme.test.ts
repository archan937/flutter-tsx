import { describe, expect, it } from 'bun:test';

import { themeToMaterialAppProps } from '@src/flutter/theme.js';

describe('themeToMaterialAppProps', () => {
  it('seeds the scheme from a single primary color', () => {
    const props = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    expect(props.theme).toContain('ColorScheme.fromSeed');
    expect(props.theme).toContain('Color(0xFF54a4ff)');
    expect(props.theme).toContain('Brightness.light');
    expect(props.darkTheme).toBeUndefined();
  });

  it('emits a full ColorScheme when multiple colors are set', () => {
    const props = themeToMaterialAppProps({
      light: { primary: '#54a4ff', secondary: '#a78bfa' },
    });
    expect(props.theme).toContain('ColorScheme(');
    expect(props.theme).toContain('primary: Color(0xFF54a4ff)');
    expect(props.theme).toContain('secondary: Color(0xFFa78bfa)');
  });

  it('emits darkTheme when a dark palette is provided', () => {
    const props = themeToMaterialAppProps({
      light: { primary: '#54a4ff' },
      dark: { primary: '#0d1117' },
    });
    expect(props.darkTheme).toContain('Brightness.dark');
    expect(props.darkTheme).toContain('Color(0xFF0d1117)');
  });

  it('is deterministic', () => {
    const a = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    const b = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    expect(a).toEqual(b);
  });
});
