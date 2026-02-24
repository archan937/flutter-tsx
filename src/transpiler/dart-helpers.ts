/**
 * dart-helpers.ts
 *
 * Transforms TSX prop values to their Dart equivalents.
 */

/**
 * Transform a CSS-style color string to Dart Color literal.
 *
 * Supports:
 *   "#RRGGBB"     → Color(0xFFRRGGBB)
 *   "#RRGGBBAA"   → Color(0xAARRGGBB)
 *   "#RGB"        → Color(0xFFRRGGBB)
 *   "Colors.red"  → Colors.red  (pass-through)
 *   "0xFF..."     → Color(0xFF...)
 */
export function transformColor(value: string): string {
  if (typeof value !== "string") return String(value);

  // Already a Dart expression
  if (value.startsWith("Colors.") || value.startsWith("Color(") || value.startsWith("Theme.")) {
    return value;
  }

  // Numeric hex
  if (/^0x[0-9A-Fa-f]{8}$/i.test(value)) {
    return `Color(${value})`;
  }

  // Hex color
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return `const Color(0xFF${r}${g}${b})`;
    }
    if (hex.length === 6) {
      return `const Color(0xFF${hex.toUpperCase()})`;
    }
    if (hex.length === 8) {
      // RRGGBBAA → AARRGGBB
      const rrggbb = hex.slice(0, 6);
      const aa = hex.slice(6);
      return `const Color(0x${aa.toUpperCase()}${rrggbb.toUpperCase()})`;
    }
  }

  // Named colors — map common CSS names to Flutter Colors.*
  const namedColors: Record<string, string> = {
    red: "Colors.red",
    blue: "Colors.blue",
    green: "Colors.green",
    white: "Colors.white",
    black: "Colors.black",
    transparent: "Colors.transparent",
    yellow: "Colors.yellow",
    orange: "Colors.orange",
    purple: "Colors.purple",
    pink: "Colors.pink",
    grey: "Colors.grey",
    gray: "Colors.grey",
    cyan: "Colors.cyan",
    teal: "Colors.teal",
    indigo: "Colors.indigo",
    amber: "Colors.amber",
    lime: "Colors.lime",
    brown: "Colors.brown",
  };

  const lower = value.toLowerCase();
  if (namedColors[lower]) return namedColors[lower];

  // Fallback: return as-is (may be a variable reference)
  return value;
}

/**
 * Transform a padding/margin value to Dart EdgeInsets.
 *
 * Supports:
 *   8           → EdgeInsets.all(8)
 *   [8, 16]     → EdgeInsets.symmetric(vertical: 8, horizontal: 16)
 *   [8, 16, 8, 16] → EdgeInsets.fromLTRB(16, 8, 16, 8)
 *   "8px"       → EdgeInsets.all(8)
 */
export function transformPadding(value: unknown): string {
  if (typeof value === "number") {
    return `EdgeInsets.all(${value})`;
  }

  if (typeof value === "string") {
    // Handle "8px", "8.0"
    const numStr = value.replace(/px$/, "").trim();
    const num = parseFloat(numStr);
    if (!isNaN(num)) return `EdgeInsets.all(${num})`;
    // Already a Dart expression
    if (value.startsWith("EdgeInsets")) return value;
    return `EdgeInsets.all(0)`;
  }

  if (Array.isArray(value)) {
    if (value.length === 1) {
      return `EdgeInsets.all(${value[0]})`;
    }
    if (value.length === 2) {
      return `EdgeInsets.symmetric(vertical: ${value[0]}, horizontal: ${value[1]})`;
    }
    if (value.length === 4) {
      // CSS order: top right bottom left → Dart: left top right bottom
      const [top, right, bottom, left] = value as number[];
      return `EdgeInsets.fromLTRB(${left}, ${top}, ${right}, ${bottom})`;
    }
  }

  return `EdgeInsets.all(0)`;
}

/**
 * Transform a callback prop for Dart.
 *
 * In TSX: onClick={() => doSomething()}
 * In Dart: onPressed: () { doSomething(); }
 *
 * The actual transformation of the callback body happens in codegen.ts.
 * This helper just marks it as a callback for the codegen to handle.
 */
export function transformCallback(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "function") return "() {}";
  return "null";
}

/**
 * Transform a text style object to Dart TextStyle.
 */
export function transformTextStyle(value: Record<string, unknown>): string {
  if (!value || typeof value !== "object") return "const TextStyle()";

  const parts: string[] = [];

  if (value.color) parts.push(`color: ${transformColor(String(value.color))}`);
  if (value.fontSize !== undefined) parts.push(`fontSize: ${value.fontSize}`);
  if (value.fontWeight) {
    const fw = String(value.fontWeight);
    const dartFw = fw === "bold" ? "FontWeight.bold"
      : fw.startsWith("w") ? `FontWeight.${fw}`
        : fw === "normal" ? "FontWeight.normal"
          : fw;
    parts.push(`fontWeight: ${dartFw}`);
  }
  if (value.fontStyle) {
    parts.push(`fontStyle: FontStyle.${value.fontStyle}`);
  }
  if (value.letterSpacing !== undefined) parts.push(`letterSpacing: ${value.letterSpacing}`);
  if (value.wordSpacing !== undefined) parts.push(`wordSpacing: ${value.wordSpacing}`);
  if (value.decoration) {
    const deco = String(value.decoration);
    const dartDeco = deco === "underline" ? "TextDecoration.underline"
      : deco === "lineThrough" ? "TextDecoration.lineThrough"
        : deco === "overline" ? "TextDecoration.overline"
          : "TextDecoration.none";
    parts.push(`decoration: ${dartDeco}`);
  }
  if (value.height !== undefined) parts.push(`height: ${value.height}`);
  if (value.fontFamily) parts.push(`fontFamily: '${value.fontFamily}'`);

  return `TextStyle(${parts.join(", ")})`;
}

/**
 * Transform a MainAxisAlignment / CrossAxisAlignment string.
 */
export function transformAlignment(value: string, enumName: string): string {
  const map: Record<string, string> = {
    start: "start",
    end: "end",
    center: "center",
    spaceBetween: "spaceBetween",
    spaceAround: "spaceAround",
    spaceEvenly: "spaceEvenly",
    stretch: "stretch",
    baseline: "baseline",
  };
  const key = map[value] ?? value;
  return `${enumName}.${key}`;
}

/**
 * Escape a string for use as a Dart string literal.
 */
export function escapeDartString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\$/g, "\\$");
}

/**
 * Format a Dart string literal. Uses single quotes.
 */
export function dartString(value: string): string {
  return `'${escapeDartString(value)}'`;
}
