/**
 * Shared "sugar" constants for gesture props and implicit animation (feature #8).
 * This is a dependency-free leaf module so both the transpiler (codegen.ts) and
 * the type generator (scripts/generate-types.ts) can import it — single source
 * of truth for which widgets are animatable and which gesture props exist.
 */

/**
 * Gesture props usable on ANY widget. When the target widget declares the prop
 * natively (e.g. GestureDetector, InkWell) it passes straight through; otherwise
 * the widget is auto-wrapped in a GestureDetector carrying these callbacks.
 * All three are `() => void` in Flutter, matching the native widget signatures.
 */
export const GESTURE_PROPS = ['onTap', 'onDoubleTap', 'onLongPress'] as const;

/**
 * Widgets where a `label="…"` shorthand maps to the Dart `decoration:
 * InputDecoration(labelText: …)` (codegen's transformStringProp). It's a
 * flutter-tsx convenience not present on the Dart constructor, so the type
 * generator injects `label?: string` for these widgets.
 */
export const LABEL_SUGAR_WIDGETS = ['TextField'] as const;

/**
 * `animate` swaps a widget for its implicit-animation twin. Only widgets with a
 * direct Animated* counterpart are animatable; the swap reuses the same props.
 */
export const ANIMATED_TWIN: Readonly<Record<string, string>> = {
  Container: 'AnimatedContainer',
  Opacity: 'AnimatedOpacity',
  Align: 'AnimatedAlign',
  Padding: 'AnimatedPadding',
  Positioned: 'AnimatedPositioned',
  DefaultTextStyle: 'AnimatedDefaultTextStyle',
  FractionallySizedBox: 'AnimatedFractionallySizedBox',
};

export const DEFAULT_ANIMATION_DURATION_MS = 300;

/** Common Flutter curve names, exposed as a typed union on the `curve` prop. */
export const CURVE_NAMES = [
  'linear',
  'ease',
  'easeIn',
  'easeOut',
  'easeInOut',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'fastOutSlowIn',
  'decelerate',
  'bounceIn',
  'bounceOut',
  'bounceInOut',
  'elasticIn',
  'elasticOut',
  'elasticInOut',
] as const;
