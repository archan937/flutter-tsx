import ts from 'typescript';

import { normalizeOperators } from './dart-helpers.js';

type VisitJSX = (
  node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
) => string;

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;

const findJSXInExpr = (expr: ts.Expression): JsxNode | null => {
  if (
    ts.isJsxElement(expr) ||
    ts.isJsxSelfClosingElement(expr) ||
    ts.isJsxFragment(expr)
  ) {
    return expr;
  }
  if (ts.isParenthesizedExpression(expr)) return findJSXInExpr(expr.expression);
  return null;
};

const findJSXInConciseBody = (body: ts.ConciseBody): JsxNode | null => {
  if (!ts.isBlock(body)) return findJSXInExpr(body);

  for (const stmt of body.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      const jsx = findJSXInExpr(stmt.expression);
      if (jsx) return jsx;
    }
  }
  return null;
};

const rewriteFilterToWhere = (
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
): string => {
  if (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    expr.expression.name.getText(sourceFile) === 'filter'
  ) {
    const inner = rewriteFilterToWhere(expr.expression.expression, sourceFile);
    const args = expr.arguments.map((a) => a.getText(sourceFile)).join(', ');
    return `${inner}.where(${args})`;
  }
  return expr.getText(sourceFile);
};

const isNullish = (expr: ts.Expression): boolean =>
  expr.kind === ts.SyntaxKind.NullKeyword ||
  (ts.isIdentifier(expr) && expr.text === 'undefined');

export const tryTransformMapCall = (
  expr: ts.CallExpression,
  sourceFile: ts.SourceFile,
  visitJSX: VisitJSX,
): string | null => {
  if (!ts.isPropertyAccessExpression(expr.expression)) return null;
  if (expr.expression.name.getText(sourceFile) !== 'map') return null;
  if (expr.arguments.length !== 1) return null;

  const arg = expr.arguments[0];
  if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) return null;

  const { parameters, body } = arg;
  if (parameters.length === 0 || parameters.length > 2) return null;

  const jsxNode = findJSXInConciseBody(body);
  if (!jsxNode) return null;

  const receiver = rewriteFilterToWhere(expr.expression.expression, sourceFile);
  const itemParam = parameters[0].name.getText(sourceFile);
  const dartWidget = visitJSX(jsxNode);

  if (parameters.length === 1) {
    return `...${receiver}.map((${itemParam}) => ${dartWidget}).toList()`;
  }

  const indexParam = parameters[1].name.getText(sourceFile);
  return (
    `...${receiver}.asMap().entries.map((entry) { ` +
    `final ${indexParam} = entry.key; ` +
    `final ${itemParam} = entry.value; ` +
    `return ${dartWidget}; }).toList()`
  );
};

export const tryTransformTernary = (
  expr: ts.ConditionalExpression,
  sourceFile: ts.SourceFile,
  visitJSX: VisitJSX,
): string | null => {
  const thenJsx = findJSXInExpr(expr.whenTrue);
  const elseJsx = findJSXInExpr(expr.whenFalse);

  if (!thenJsx && !elseJsx) return null;

  const condText = normalizeOperators(expr.condition.getText(sourceFile));

  const dartThen = thenJsx
    ? visitJSX(thenJsx)
    : isNullish(expr.whenTrue)
      ? 'const SizedBox.shrink()'
      : expr.whenTrue.getText(sourceFile);

  const dartElse = elseJsx
    ? visitJSX(elseJsx)
    : isNullish(expr.whenFalse)
      ? 'const SizedBox.shrink()'
      : expr.whenFalse.getText(sourceFile);

  return `${condText} ? ${dartThen} : ${dartElse}`;
};

export const tryTransformAndExpression = (
  expr: ts.BinaryExpression,
  sourceFile: ts.SourceFile,
  visitJSX: VisitJSX,
): string | null => {
  if (expr.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken)
    return null;

  const jsxNode = findJSXInExpr(expr.right);
  if (!jsxNode) return null;

  const condText = normalizeOperators(expr.left.getText(sourceFile));
  const dartWidget = visitJSX(jsxNode);

  return `if (${condText}) ${dartWidget}`;
};
