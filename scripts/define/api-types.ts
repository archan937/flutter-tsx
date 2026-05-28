export type ScalarTypeName = 'String' | 'bool' | 'int' | 'double' | 'num';

export type TypeNode =
  | { kind: 'scalar'; name: ScalarTypeName }
  | { kind: 'void' }
  | { kind: 'unknown' }
  | { kind: 'nullable'; inner: TypeNode }
  | { kind: 'list'; element: TypeNode }
  | { kind: 'set'; element: TypeNode }
  | { kind: 'map'; key: TypeNode; value: TypeNode }
  | { kind: 'future'; value: TypeNode }
  | { kind: 'function'; returnType: TypeNode; params: FunctionParam[] }
  | { kind: 'enum'; name: string }
  | { kind: 'widget' }
  | { kind: 'named'; name: string };

export interface FunctionParam {
  name: string;
  type: TypeNode;
  named: boolean;
  required: boolean;
}

export interface ParamInfo {
  name: string;
  type: TypeNode;
  isNamed: boolean;
  isRequired: boolean;
  hasDefault: boolean;
  deprecated: boolean;
}

export interface WidgetEntity {
  family: 'widget';
  name: string;
  library: string;
  doc: string;
  params: ParamInfo[];
}

export interface EnumEntity {
  family: 'enum';
  name: string;
  library: string;
  values: string[];
}

export interface TypeEntity {
  family: 'type';
  name: string;
  library: string;
  doc: string;
  params: ParamInfo[];
}

export type Entity = WidgetEntity | EnumEntity | TypeEntity;

export interface ApiJson {
  _meta: {
    frameworkVersion: string;
    dartSdkVersion: string;
    frameworkRevision: string;
    extractedAt: string;
  };
  entities: Entity[];
}

// ─── widgets.json contract (ref/derived/widgets.json) ─────────────────────────

export type WidgetCategory =
  | 'layout'
  | 'input'
  | 'display'
  | 'navigation'
  | 'other';
export type ChildSlot =
  | 'child'
  | 'children'
  | 'home'
  | 'body'
  | 'title'
  | 'none';
export type Transform =
  | 'callback'
  | 'style'
  | 'textStyle'
  | 'color'
  | 'edgeinsets'
  | 'string'
  | 'int'
  | 'double'
  | 'widget'
  | 'enum'
  | 'none';

export interface PropDef {
  name: string;
  tsxProp: string;
  dartParam: string;
  dartType: string;
  tsType: string;
  required: boolean;
  transform: Transform;
}

export interface StylingDef {
  name: string;
  tsxProp: string;
  dartParam: string;
  dartType: string;
  tsType: string;
  transform: Transform;
}

export interface WidgetDef {
  name: string;
  dartClass: string;
  category: WidgetCategory;
  selfSlot: string;
  defaultChildSlot: ChildSlot;
  singleChild: boolean;
  props: PropDef[];
  styling: StylingDef[];
}

// ─── types.json contract (ref/derived/types.json) ────────────────────────────

export interface TypeDef {
  name: string;
  dartClass: string;
  library: string;
  doc: string;
  params: PropDef[];
}

// ─── hooks.json contract (ref/derived/hooks.json) ────────────────────────────

export interface HookFunctionArg {
  name: string;
  tsType: string;
  dartType: string;
  required: boolean;
}

export interface HookFunction {
  name: string;
  args: HookFunctionArg[];
  returns: string;
  behavior: string;
}

export interface HookDef {
  name: string;
  dartPackage: string;
  pubspecDep: string;
  tsxHook: string;
  functions: HookFunction[];
}

// ─── functions.json contract (ref/derived/functions.json) ─────────────────────

export interface FunctionArg {
  name: string;
  tsType: string;
  required: boolean;
}

export interface FunctionDef {
  name: string;
  description: string;
  args: FunctionArg[];
  returns: string;
  dartImport: string;
  package?: string;
  pubspecDep?: string;
  dart: string;
}

// ─── plugins.json contract (ref/derived/plugins.json) ─────────────────────────

export type PluginDomain =
  | 'media'
  | 'maps-location'
  | 'storage-data'
  | 'security'
  | 'files-assets'
  | 'device-system'
  | 'web-networking'
  | 'auth-payments'
  | 'navigation'
  | 'utility';

export type PluginSurface =
  | 'action'
  | 'state'
  | 'client'
  | 'widget'
  | 'function';

export interface PluginDef {
  name: string;
  domain: PluginDomain;
  surface: PluginSurface;
  tsxName: string;
  description: string;
  package?: string;
  pubspecDep?: string;
  dartImport: string;
  tsxExample: string;
  dartExample: string;
}
