/**
 * Pure helpers that synthesize a minimal, valid TSX usage for every generated
 * construct (hook / widget / feature-function) so the analyze gate can prove the
 * emitted Dart conforms to the real plugin API. Kept pure + unit-testable; the
 * SDK-driven derived JSON is the single source of truth — nothing here hardcodes
 * per-plugin Dart.
 */

export interface HookFnArg {
  name: string;
  tsType: string;
  required?: boolean;
}

export interface HookFn {
  name: string;
  args: HookFnArg[];
  returns: string;
}

export interface HookDef {
  tsxHook: string;
  functions: HookFn[];
}

export interface WidgetPlugin {
  tsxName: string;
  tsxExample: string;
}

/** A TSX literal that satisfies the given (possibly structured) TS type. */
export const sampleValueForType = (tsType: string): string => {
  const type = tsType.trim();
  if (/^number$/.test(type)) return '1';
  if (/^boolean$/.test(type)) return 'true';
  if (/^string$/.test(type)) return "'x'";
  if (type.endsWith('[]')) return `[${sampleValueForType(type.slice(0, -2))}]`;
  if (type.startsWith('{')) {
    const inner = type.slice(1, -1);
    const fields = inner
      .split(';')
      .map((field) => field.trim())
      .filter(Boolean)
      .map((field) => {
        const [key, fieldType] = field.split(':');
        // Optional keys (`zoom?: number`) are included too, so $0.key templates
        // are fully exercised.
        return `${key.replace('?', '').trim()}: ${sampleValueForType(fieldType ?? 'string')}`;
      });
    return `{ ${fields.join(', ')} }`;
  }
  if (type.includes('|')) {
    return sampleValueForType(type.split('|')[0]);
  }
  return "'x'";
};

// Pass ALL args (incl. optional) so every $N placeholder is exercised.
const callArgs = (args: HookFnArg[]): string =>
  args.map((arg) => sampleValueForType(arg.tsType)).join(', ');

/**
 * Wrap an action-hook usage into a valid TSX component. Only methods that the
 * codegen map actually wires are called (lifecycle-only entries like a camera's
 * `dispose` aren't callable), so the gate flags real bugs, not test mis-use.
 */
export const synthHookComponent = (
  hook: HookDef,
  index: number,
  wiredMethods: ReadonlySet<string>,
): string => {
  const local = '_h';
  const calls = hook.functions
    .filter((fn) => wiredMethods.has(fn.name))
    .map((fn) => `  await ${local}.${fn.name}(${callArgs(fn.args)});`)
    .join('\n');
  return `import { Text, ${hook.tsxHook} } from 'flutter-tsx';
export function Case${index}() {
  const ${local} = ${hook.tsxHook}();
  const run = async () => {
${calls}
  };
  return <Text onTap={run}>case</Text>;
}`;
};

/**
 * State hooks (no callable methods — they expose reactive values) are used by
 * destructuring; drive those cases from the recipe's documented tsxExample,
 * wrapped into a component so it transpiles as a real screen would.
 */
export const synthStateHookComponent = (
  tsxHook: string,
  tsxExample: string,
  index: number,
): string => {
  const body = tsxExample.includes('return ')
    ? tsxExample
    : `${tsxExample}\n  return <Text>case</Text>;`;
  return `import { Text, ${tsxHook} } from 'flutter-tsx';
export function Case${index}() {
  ${body.replace(/\n/g, '\n  ')}
}`;
};

/** Wrap a plugin widget's recipe example into a valid TSX component. */
export const synthWidgetComponent = (
  widget: WidgetPlugin,
  index: number,
): string =>
  `import { ${widget.tsxName} } from 'flutter-tsx';
export function Case${index}() {
  return ${widget.tsxExample.replace(/\n/g, '\n  ')};
}`;
