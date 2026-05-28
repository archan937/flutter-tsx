import type { TypeNode } from './api-types';

const SCALAR_MAP: Record<string, string> = {
  String: 'string',
  bool: 'boolean',
  int: 'number',
  double: 'number',
  num: 'number',
};

// Ergonomic overrides for Dart value classes and pseudo-enum classes that have
// no clean structural equivalent in TypeScript.
const NAMED_TYPE_MAP: Record<string, string> = {
  Color: 'string',
  EdgeInsetsGeometry:
    'number | [number, number] | [number, number, number, number]',
  EdgeInsets: 'number | [number, number] | [number, number, number, number]',
  EdgeInsetsDirectional:
    'number | [number, number] | [number, number, number, number]',
  AlignmentGeometry: 'string',
  Alignment: 'string',
  AlignmentDirectional: 'string',
  FractionalOffset: 'string',
  TextStyle: 'TextStyleProps',
  IconData: 'string',
  ThemeData: 'Record<string, unknown>',
  FontWeight:
    "'normal' | 'bold' | 'w100' | 'w200' | 'w300' | 'w400' | 'w500' | 'w600' | 'w700' | 'w800' | 'w900'",
  TextInputType: "'text' | 'number' | 'phone' | 'email' | 'url' | 'multiline'",
};

// Translate a structured TypeNode (from the Dart extractor) to a TypeScript
// type string. Nullability is handled at the prop-key level (optional `?:`),
// so nullable nodes delegate straight to their inner type.
export const translateType = (
  node: TypeNode,
  enumMap: Map<string, string[]>,
): string => {
  switch (node.kind) {
    case 'scalar':
      return SCALAR_MAP[node.name] ?? 'unknown';
    case 'void':
      return 'void';
    case 'unknown':
      return 'unknown';
    case 'nullable':
      return translateType(node.inner, enumMap);
    case 'list':
      return `${translateType(node.element, enumMap)}[]`;
    case 'set':
      return `Set<${translateType(node.element, enumMap)}>`;
    case 'map': {
      const keyType = translateType(node.key, enumMap);
      const valType = translateType(node.value, enumMap);
      return `Record<${keyType === 'unknown' ? 'string' : keyType}, ${valType}>`;
    }
    case 'future':
      return `Promise<${translateType(node.value, enumMap)}>`;
    case 'function': {
      const visible = node.params.filter(
        (p) => !(p.type.kind === 'named' && p.type.name === 'BuildContext'),
      );
      const paramStr = visible
        .map(
          (p, i) => `${p.name || `p${i}`}: ${translateType(p.type, enumMap)}`,
        )
        .join(', ');
      return `(${paramStr}) => ${translateType(node.returnType, enumMap)}`;
    }
    case 'enum': {
      const values = enumMap.get(node.name);
      return values ? values.map((v) => `'${v}'`).join(' | ') : 'string';
    }
    case 'widget':
      return 'FlutterElement';
    case 'named':
      return NAMED_TYPE_MAP[node.name] ?? 'unknown';
  }
};

// Produce a canonical Dart type string from a TypeNode — used for the
// `dartType` field in widgets.json (consumed by the transpiler's inferTransform).
export const dartTypeString = (node: TypeNode): string => {
  switch (node.kind) {
    case 'scalar':
      return node.name;
    case 'void':
      return 'void';
    case 'unknown':
      return 'dynamic';
    case 'nullable':
      return `${dartTypeString(node.inner)}?`;
    case 'list':
      return `List<${dartTypeString(node.element)}>`;
    case 'set':
      return `Set<${dartTypeString(node.element)}>`;
    case 'map':
      return `Map<${dartTypeString(node.key)}, ${dartTypeString(node.value)}>`;
    case 'future':
      return `Future<${dartTypeString(node.value)}>`;
    case 'function': {
      const paramStr = node.params
        .map((p) => dartTypeString(p.type))
        .join(', ');
      return `${dartTypeString(node.returnType)} Function(${paramStr})`;
    }
    case 'enum':
      return node.name;
    case 'widget':
      return 'Widget';
    case 'named':
      return node.name;
  }
};
