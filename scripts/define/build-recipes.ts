import type { FunctionDef, HookDef, PluginDef } from './api-types';
import type {
  DartCodegen,
  FunctionRecipe,
  HookRecipe,
  PluginRecipe,
  WidgetPluginRecipe,
} from './recipe-types';
import { ALL_RECIPES } from './recipes/index';

export interface RecipeBuildResult {
  hooks: HookDef[];
  functions: FunctionDef[];
  plugins: PluginDef[];
}

const isHookRecipe = (r: PluginRecipe): r is HookRecipe =>
  r.surface === 'action' || r.surface === 'state' || r.surface === 'client';

const isWidgetRecipe = (r: PluginRecipe): r is WidgetPluginRecipe =>
  r.surface === 'widget';

const isFunctionRecipe = (r: PluginRecipe): r is FunctionRecipe =>
  r.surface === 'function';

const toPluginDef = (r: PluginRecipe): PluginDef => ({
  name: r.tsxName,
  domain: r.domain,
  surface: r.surface,
  tsxName: r.tsxName,
  description: r.description,
  package: r.package,
  pubspecDep: r.pubspecDep,
  dartImport: r.dartImport,
  tsxExample: r.tsxExample,
  dartExample: r.dartExample,
});

const toFunctionDef = (r: FunctionRecipe): FunctionDef => ({
  name: r.tsxName,
  description: r.description,
  args: r.args,
  returns: r.returns,
  dartImport: r.dartImport,
  package: r.package,
  pubspecDep: r.pubspecDep,
  dart: r.dart.expression ?? r.tsxName,
});

export const buildRecipes = (
  recipes: PluginRecipe[] = ALL_RECIPES,
): RecipeBuildResult => {
  const hooks: HookDef[] = [];
  const functions: FunctionDef[] = [];
  const plugins: PluginDef[] = [];

  for (const recipe of recipes) {
    plugins.push(toPluginDef(recipe));

    if (isHookRecipe(recipe)) {
      hooks.push(recipe.hookDef);
    } else if (isWidgetRecipe(recipe)) {
      if (recipe.additionalHook) {
        plugins.push(toPluginDef(recipe.additionalHook));
        hooks.push(recipe.additionalHook.hookDef);
      }
    } else if (isFunctionRecipe(recipe)) {
      functions.push(toFunctionDef(recipe));
    }
  }

  return { hooks, functions, plugins };
};

export const buildCodegenMap = (
  recipes: PluginRecipe[] = ALL_RECIPES,
): Record<string, DartCodegen> => {
  const map: Record<string, DartCodegen> = {};

  for (const recipe of recipes) {
    if (isHookRecipe(recipe)) {
      map[recipe.tsxName] = recipe.dart;
    } else if (isWidgetRecipe(recipe)) {
      // The widget itself is data-driven too (render/propMap/controllerField);
      // codegen reads this entry instead of hardcoding per-widget logic.
      map[recipe.tsxName] = recipe.dart;
      if (recipe.additionalHook) {
        map[recipe.additionalHook.tsxName] = recipe.additionalHook.dart;
      }
    }
  }

  return map;
};
