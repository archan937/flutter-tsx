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
      .filter((field) => !field.includes('?:')) // required keys only
      .map((field) => {
        const [key, fieldType] = field.split(':');
        return `${key.trim()}: ${sampleValueForType(fieldType ?? 'string')}`;
      });
    return `{ ${fields.join(', ')} }`;
  }
  if (type.includes('|')) {
    return sampleValueForType(type.split('|')[0]);
  }
  return "'x'";
};

const callArgs = (args: HookFnArg[]): string =>
  args
    .filter((arg) => arg.required !== false)
    .map((arg) => sampleValueForType(arg.tsType))
    .join(', ');

/** Wrap a body that uses a hook into a valid awaitable TSX component. */
export const synthHookComponent = (hook: HookDef, index: number): string => {
  const local = '_h';
  const calls = hook.functions
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

/** Wrap a plugin widget's recipe example into a valid TSX component. */
export const synthWidgetComponent = (
  widget: WidgetPlugin,
  index: number,
): string =>
  `import { ${widget.tsxName} } from 'flutter-tsx';
export function Case${index}() {
  return ${widget.tsxExample.replace(/\n/g, '\n  ')};
}`;
