import ts from 'typescript';

import { PLUGIN_MAP, type PluginDef } from '../generated/plugin-map.js';

export interface StateVar {
  name: string;
  setter: string;
  tsType: string;
  dartType: string;
  initializer: string;
}

export interface PluginUsage {
  varName: string;
  hookName: string;
  pluginDef: PluginDef;
}

export interface HandlerDef {
  name: string;
  isAsync: boolean;
  node: ts.ArrowFunction | ts.FunctionExpression;
}

export interface HooksAnalysis {
  stateVars: StateVar[];
  hasEffects: boolean;
  effectBodies: string[];
  effectStatements: ts.Statement[][];
  effectCleanups: string[];
  pluginUsages: PluginUsage[];
  handlerFunctions: HandlerDef[];
}

const TS_TO_DART_TYPE: Record<string, string> = {
  number: 'double',
  string: 'String',
  boolean: 'bool',
  'string[]': 'List<String>',
  'number[]': 'List<double>',
  unknown: 'dynamic',
  null: 'dynamic',
  undefined: 'dynamic',
};

const inferDartType = (tsType: string, initializer: string): string => {
  if (/^\d+$/.test(initializer)) return 'int';
  if (/^\d+\.\d+$/.test(initializer)) return 'double';
  if (initializer === 'true' || initializer === 'false') return 'bool';
  if (
    initializer.startsWith('"') ||
    initializer.startsWith("'") ||
    initializer.startsWith('`')
  )
    return 'String';
  if (initializer === '[]') return 'List<dynamic>';
  if (initializer === '{}') return 'Map<String, dynamic>';
  if (initializer === 'null') return 'dynamic';

  return TS_TO_DART_TYPE[tsType.toLowerCase()] ?? 'dynamic';
};

const HOOK_SURFACES = new Set(['action', 'state', 'client']);

export const analyzeHooks = (
  funcBody: ts.Block,
  sourceFile: ts.SourceFile,
): HooksAnalysis => {
  const stateVars: StateVar[] = [];
  const effectBodies: string[] = [];
  const effectStatements: ts.Statement[][] = [];
  const effectCleanups: string[] = [];
  const pluginUsages: PluginUsage[] = [];
  const handlerFunctions: HandlerDef[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length === 1
    ) {
      const decl = node.declarationList.declarations[0];

      if (
        (ts.isIdentifier(decl.name) || ts.isObjectBindingPattern(decl.name)) &&
        decl.initializer &&
        ts.isCallExpression(decl.initializer)
      ) {
        const hookName = decl.initializer.expression.getText(sourceFile);
        const pluginDef = PLUGIN_MAP.get(hookName);
        if (pluginDef && HOOK_SURFACES.has(pluginDef.surface)) {
          // Destructured state hooks (`const { isOnline } = useConnectivity()`)
          // count as a usage too, so the widget goes stateful and the hook's
          // controllerField / initState get applied (the binding itself is
          // emitted in build() via the recipe stateMap).
          pluginUsages.push({
            varName: ts.isIdentifier(decl.name)
              ? decl.name.getText(sourceFile)
              : hookName,
            hookName,
            pluginDef,
          });
        }
      }

      // Local handler function: const fn = () => { ... } or const fn = async () => { ... }
      if (
        ts.isIdentifier(decl.name) &&
        decl.initializer &&
        (ts.isArrowFunction(decl.initializer) ||
          ts.isFunctionExpression(decl.initializer))
      ) {
        handlerFunctions.push({
          name: decl.name.getText(sourceFile),
          isAsync:
            decl.initializer.modifiers?.some(
              (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
            ) ?? false,
          node: decl.initializer,
        });
      }

      if (
        ts.isArrayBindingPattern(decl.name) &&
        decl.initializer &&
        ts.isCallExpression(decl.initializer)
      ) {
        const call = decl.initializer;
        const callee = call.expression.getText(sourceFile);

        if (callee === 'useState' && decl.name.elements.length === 2) {
          const valueEl = decl.name.elements[0];
          const setterEl = decl.name.elements[1];

          if (
            ts.isBindingElement(valueEl) &&
            ts.isBindingElement(setterEl) &&
            ts.isIdentifier(valueEl.name) &&
            ts.isIdentifier(setterEl.name)
          ) {
            const name = valueEl.name.getText(sourceFile);
            const setter = setterEl.name.getText(sourceFile);
            const initArg = call.arguments[0];
            const initializer = initArg ? initArg.getText(sourceFile) : 'null';

            let tsType = 'unknown';
            if (call.typeArguments && call.typeArguments.length > 0) {
              tsType = call.typeArguments[0].getText(sourceFile);
            }

            stateVars.push({
              name,
              setter,
              tsType,
              dartType: inferDartType(tsType, initializer),
              initializer,
            });
          }
        }
      }
    }

    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression)
    ) {
      const call = node.expression;
      const callee = call.expression.getText(sourceFile);

      if (callee === 'useEffect' && call.arguments.length >= 1) {
        const effectArg = call.arguments[0];
        if (
          ts.isArrowFunction(effectArg) ||
          ts.isFunctionExpression(effectArg)
        ) {
          const { body } = effectArg;
          let bodyText = '';
          let cleanupText = '';

          if (ts.isBlock(body)) {
            const { statements } = body;
            const returnStmt = statements.find((s): s is ts.ReturnStatement =>
              ts.isReturnStatement(s),
            );

            if (returnStmt?.expression) {
              cleanupText = returnStmt.expression.getText(sourceFile);
            }

            const nonReturnStmts = statements.filter(
              (s) => !ts.isReturnStatement(s),
            );
            bodyText = nonReturnStmts
              .map((s) => s.getText(sourceFile))
              .join('\n');
            effectStatements.push([...nonReturnStmts]);
          } else {
            bodyText = body.getText(sourceFile);
            effectStatements.push([]);
          }

          effectBodies.push(bodyText);
          effectCleanups.push(cleanupText);
        }
      }
    }

    if (
      !ts.isArrowFunction(node) &&
      !ts.isFunctionExpression(node) &&
      !ts.isFunctionDeclaration(node) &&
      !ts.isClassDeclaration(node) &&
      !ts.isClassExpression(node)
    ) {
      ts.forEachChild(node, visit);
    }
  };

  ts.forEachChild(funcBody, visit);

  return {
    stateVars,
    hasEffects: effectBodies.length > 0,
    effectBodies,
    effectStatements,
    effectCleanups,
    pluginUsages,
    handlerFunctions,
  };
};
