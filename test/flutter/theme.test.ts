import '../helpers/resemble.js';

import { describe, expect, it } from 'bun:test';

import { themeToMaterialAppProps } from '@src/flutter/theme.js';

describe('themeToMaterialAppProps', () => {
  it('seeds the scheme from a single primary color', () => {
    const props = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    expect(props.theme).toResemble(
      'ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Color(0xFF54a4ff), brightness: Brightness.light))',
    );
    expect(props.darkTheme).toBeUndefined();
  });

  it('emits a full ColorScheme when multiple colors are set', () => {
    const props = themeToMaterialAppProps({
      light: { primary: '#54a4ff', secondary: '#a78bfa' },
    });
    expect(props.theme).toResemble(`
      ThemeData(colorScheme: ColorScheme(
        brightness: Brightness.light,
        primary: Color(0xFF54a4ff),
        secondary: Color(0xFFa78bfa),
      ))`);
  });

  it('emits darkTheme when a dark palette is provided', () => {
    const props = themeToMaterialAppProps({
      light: { primary: '#54a4ff' },
      dark: { primary: '#0d1117' },
    });
    expect(props.darkTheme).toResemble(
      'ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Color(0xFF0d1117), brightness: Brightness.dark))',
    );
  });

  it('is deterministic', () => {
    const a = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    const b = themeToMaterialAppProps({ light: { primary: '#54a4ff' } });
    expect(a).toEqual(b);
  });
});
