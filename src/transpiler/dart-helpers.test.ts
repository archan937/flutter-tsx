import { describe, expect, it } from 'bun:test';

import {
  dartString,
  escapeDartString,
  transformAlignment,
  transformCallback,
  transformColor,
  transformPadding,
  transformTextStyle,
} from './dart-helpers.js';

describe('transformColor', () => {
  it('passes through Colors.* values', () => {
    expect(transformColor('Colors.red')).toBe('Colors.red');
    expect(transformColor('Colors.blue.shade200')).toBe('Colors.blue.shade200');
  });

  it('passes through Color(...) values', () => {
    expect(transformColor('Color(0xFF123456)')).toBe('Color(0xFF123456)');
  });

  it('passes through Theme.* values', () => {
    expect(transformColor('Theme.of(context).primaryColor')).toBe(
      'Theme.of(context).primaryColor',
    );
  });

  it('converts 0xRRGGBBAA hex to Color()', () => {
    expect(transformColor('0xFFAABBCC')).toBe('Color(0xFFAABBCC)');
  });

  it('converts #RGB shorthand to full Color', () => {
    expect(transformColor('#F0A')).toBe('const Color(0xFFFF00AA)');
  });

  it('converts #RRGGBB to Color with full opacity', () => {
    expect(transformColor('#ff5733')).toBe('const Color(0xFFFF5733)');
  });

  it('converts #RRGGBB case-insensitively', () => {
    expect(transformColor('#aabbcc')).toBe('const Color(0xFFAABBCC)');
  });

  it('converts #RRGGBBAA to Color with alpha swap', () => {
    // RRGGBBAA → 0xAARRGGBB
    expect(transformColor('#FF5733AA')).toBe('const Color(0xAAFF5733)');
  });

  it('converts named color "red"', () => {
    expect(transformColor('red')).toBe('Colors.red');
  });

  it('converts named color "blue"', () => {
    expect(transformColor('blue')).toBe('Colors.blue');
  });

  it('converts named color "transparent"', () => {
    expect(transformColor('transparent')).toBe('Colors.transparent');
  });

  it('handles "gray" alias for grey', () => {
    expect(transformColor('gray')).toBe('Colors.grey');
    expect(transformColor('grey')).toBe('Colors.grey');
  });

  it('is case-insensitive for named colors', () => {
    expect(transformColor('RED')).toBe('Colors.red');
    expect(transformColor('Blue')).toBe('Colors.blue');
  });

  it('passes through unknown values', () => {
    expect(transformColor('someVar')).toBe('someVar');
  });

  it('passes through # colors with invalid hex length', () => {
    expect(transformColor('#1234')).toBe('#1234');
  });
});

describe('transformPadding', () => {
  it('converts number to EdgeInsets.all', () => {
    expect(transformPadding(16)).toBe('EdgeInsets.all(16)');
    expect(transformPadding(0)).toBe('EdgeInsets.all(0)');
  });

  it('converts numeric string to EdgeInsets.all', () => {
    expect(transformPadding('8')).toBe('EdgeInsets.all(8)');
  });

  it('strips px suffix from string', () => {
    expect(transformPadding('16px')).toBe('EdgeInsets.all(16)');
  });

  it('passes through EdgeInsets.* string values', () => {
    expect(transformPadding('EdgeInsets.zero')).toBe('EdgeInsets.zero');
  });

  it('falls back to EdgeInsets.all(0) for invalid string', () => {
    expect(transformPadding('invalid')).toBe('EdgeInsets.all(0)');
  });

  it('converts 1-element array to EdgeInsets.all', () => {
    expect(transformPadding([8])).toBe('EdgeInsets.all(8)');
  });

  it('converts 2-element array to EdgeInsets.symmetric', () => {
    expect(transformPadding([10, 20])).toBe(
      'EdgeInsets.symmetric(vertical: 10, horizontal: 20)',
    );
  });

  it('converts 4-element array to EdgeInsets.fromLTRB (top, right, bottom, left → left, top, right, bottom)', () => {
    expect(transformPadding([5, 10, 15, 20])).toBe(
      'EdgeInsets.fromLTRB(20, 5, 10, 15)',
    );
  });

  it('falls back to EdgeInsets.all(0) for unsupported input', () => {
    expect(transformPadding(null)).toBe('EdgeInsets.all(0)');
    expect(transformPadding([1, 2, 3])).toBe('EdgeInsets.all(0)');
  });
});

describe('transformCallback', () => {
  it('returns string value as-is', () => {
    expect(transformCallback('myHandler')).toBe('myHandler');
  });

  it('returns () {} for function values', () => {
    const noop = (): void => undefined;
    expect(transformCallback(noop)).toBe('() {}');
  });

  it('returns null for other values', () => {
    expect(transformCallback(42)).toBe('null');
    expect(transformCallback(null)).toBe('null');
    expect(transformCallback(undefined)).toBe('null');
  });
});

describe('transformTextStyle', () => {
  it('returns empty TextStyle() for empty object', () => {
    expect(transformTextStyle({})).toBe('TextStyle()');
  });

  it('includes color', () => {
    expect(transformTextStyle({ color: 'red' })).toBe(
      'TextStyle(color: Colors.red)',
    );
  });

  it('includes fontSize', () => {
    expect(transformTextStyle({ fontSize: 16 })).toBe(
      'TextStyle(fontSize: 16)',
    );
  });

  it('converts bold fontWeight', () => {
    expect(transformTextStyle({ fontWeight: 'bold' })).toBe(
      'TextStyle(fontWeight: FontWeight.bold)',
    );
  });

  it('converts w700 fontWeight', () => {
    expect(transformTextStyle({ fontWeight: 'w700' })).toBe(
      'TextStyle(fontWeight: FontWeight.w700)',
    );
  });

  it('converts normal fontWeight', () => {
    expect(transformTextStyle({ fontWeight: 'normal' })).toBe(
      'TextStyle(fontWeight: FontWeight.normal)',
    );
  });

  it('converts fontStyle', () => {
    expect(transformTextStyle({ fontStyle: 'italic' })).toBe(
      'TextStyle(fontStyle: FontStyle.italic)',
    );
  });

  it('includes letterSpacing', () => {
    expect(transformTextStyle({ letterSpacing: 1.5 })).toBe(
      'TextStyle(letterSpacing: 1.5)',
    );
  });

  it('includes wordSpacing', () => {
    expect(transformTextStyle({ wordSpacing: 2 })).toBe(
      'TextStyle(wordSpacing: 2)',
    );
  });

  it('converts underline decoration', () => {
    expect(transformTextStyle({ decoration: 'underline' })).toBe(
      'TextStyle(decoration: TextDecoration.underline)',
    );
  });

  it('converts lineThrough decoration', () => {
    expect(transformTextStyle({ decoration: 'lineThrough' })).toBe(
      'TextStyle(decoration: TextDecoration.lineThrough)',
    );
  });

  it('converts overline decoration', () => {
    expect(transformTextStyle({ decoration: 'overline' })).toBe(
      'TextStyle(decoration: TextDecoration.overline)',
    );
  });

  it('falls back to TextDecoration.none for unknown decoration', () => {
    expect(transformTextStyle({ decoration: 'unknown' })).toBe(
      'TextStyle(decoration: TextDecoration.none)',
    );
  });

  it('includes height', () => {
    expect(transformTextStyle({ height: 1.4 })).toBe('TextStyle(height: 1.4)');
  });

  it('includes fontFamily', () => {
    expect(transformTextStyle({ fontFamily: 'Roboto' })).toBe(
      "TextStyle(fontFamily: 'Roboto')",
    );
  });

  it('combines multiple props', () => {
    const result = transformTextStyle({
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ff0000',
    });
    expect(result).toBe(
      'TextStyle(color: const Color(0xFFFF0000), fontSize: 18, fontWeight: FontWeight.bold)',
    );
  });

  it('returns const TextStyle() for invalid input', () => {
    expect(transformTextStyle(null as unknown as Record<string, unknown>)).toBe(
      'const TextStyle()',
    );
  });
});

describe('transformAlignment', () => {
  it('maps start', () => {
    expect(transformAlignment('start', 'MainAxisAlignment')).toBe(
      'MainAxisAlignment.start',
    );
  });

  it('maps center', () => {
    expect(transformAlignment('center', 'CrossAxisAlignment')).toBe(
      'CrossAxisAlignment.center',
    );
  });

  it('maps spaceBetween', () => {
    expect(transformAlignment('spaceBetween', 'MainAxisAlignment')).toBe(
      'MainAxisAlignment.spaceBetween',
    );
  });

  it('passes through unknown values', () => {
    expect(transformAlignment('custom', 'Alignment')).toBe('Alignment.custom');
  });
});

describe('escapeDartString', () => {
  it('escapes backslashes', () => {
    expect(escapeDartString('a\\b')).toBe('a\\\\b');
  });

  it('escapes single quotes', () => {
    expect(escapeDartString("it's")).toBe("it\\'s");
  });

  it('escapes newlines', () => {
    expect(escapeDartString('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes carriage returns', () => {
    expect(escapeDartString('a\rb')).toBe('a\\rb');
  });

  it('escapes tabs', () => {
    expect(escapeDartString('a\tb')).toBe('a\\tb');
  });

  it('escapes dollar signs', () => {
    expect(escapeDartString('$count')).toBe('\\$count');
  });

  it('leaves plain strings unchanged', () => {
    expect(escapeDartString('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeDartString('')).toBe('');
  });
});

describe('dartString', () => {
  it('wraps value in single quotes', () => {
    expect(dartString('hello')).toBe("'hello'");
  });

  it('escapes content inside quotes', () => {
    expect(dartString("it's a test")).toBe("'it\\'s a test'");
  });

  it('handles empty string', () => {
    expect(dartString('')).toBe("''");
  });

  it('escapes dollar signs in template-like strings', () => {
    expect(dartString('Value: $x')).toBe("'Value: \\$x'");
  });
});
