import type {
  FunctionArg,
  FunctionDef,
  HookDef,
  PluginDomain,
  PluginSurface,
} from './api-types';

// ─── Codegen spec (transpiler instructions) ────────────────────────────────────

export interface DartCodegen {
  imports: string[];
  controllerField?: string;
  initState?: string;
  dispose?: string;
  methods?: Record<string, string>;
  expression?: string;
  // ── Plugin-widget rendering (data-driven; no per-widget code in codegen) ──
  /** Dart widget constructor for prop-mapped widgets (e.g. CachedNetworkImage). */
  widget?: string;
  /** tsx prop → Dart named param, assembled for whichever props are present. */
  propMap?: Record<string, string>;
  /** Render template with `$prop` placeholders (alternative to widget+propMap). */
  render?: string;
  /** Fallback Dart values for `$prop` tokens absent from the JSX. */
  defaults?: Record<string, string>;
}

// ─── Plugin recipe shapes ──────────────────────────────────────────────────────

interface RecipeBase {
  domain: PluginDomain;
  surface: PluginSurface;
  tsxName: string;
  description: string;
  package?: string;
  version?: string;
  pubspecDep?: string;
  dartImport: string;
  tsxExample: string;
  dartExample: string;
  dart: DartCodegen;
}

export interface HookRecipe extends RecipeBase {
  surface: 'action' | 'state' | 'client';
  hookDef: HookDef;
}

export interface WidgetPluginRecipe extends RecipeBase {
  surface: 'widget';
  props: Array<{ name: string; tsType: string; required?: boolean }>;
  childSlot?: string;
  additionalHook?: HookRecipe;
}

export interface FunctionRecipe extends RecipeBase {
  surface: 'function';
  args: FunctionArg[];
  returns: string;
  functionDef?: FunctionDef;
}

export type PluginRecipe = HookRecipe | WidgetPluginRecipe | FunctionRecipe;
