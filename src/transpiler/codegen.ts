import ts from 'typescript';

import { CHILD_SLOT_MAP, SELF_SLOT_MAP } from '../generated/slot-map.js';
import {
  dartString,
  transformColor,
  transformPadding,
  transformTextStyle,
} from './dart-helpers.js';
import { analyzeHooks } from './hooks-analyzer.js';
import {
  type ExportedComponent,
  getFunctionBody,
  getReturnJSX,
} from './parser.js';

// ---------------------------------------------------------------------------
// CodegenContext
// ---------------------------------------------------------------------------

export class CodegenContext {
  private sourceFile: ts.SourceFile;
  private stateVarNames = new Set<string>();
  private stateSetterNames = new Set<string>();

  constructor(sourceFile: ts.SourceFile) {
    this.sourceFile = sourceFile;
  }

  // -------------------------------------------------------------------------
  // Component entry point
  // -------------------------------------------------------------------------

  generateComponent(component: ExportedComponent): string {
    const body = getFunctionBody(component.node);
    let hasState = false;

    if (body && ts.isBlock(body)) {
      const analysis = analyzeHooks(body, this.sourceFile);
      hasState = analysis.stateVars.length > 0;

      for (const sv of analysis.stateVars) {
        this.stateVarNames.add(sv.name);
        this.stateSetterNames.add(sv.setter);
      }

      if (hasState) {
        return this.genStatefulWidget(component, analysis);
      }
    }

    return this.genStatelessWidget(component);
  }

  // -------------------------------------------------------------------------
  // StatelessWidget
  // -------------------------------------------------------------------------

  private genStatelessWidget(component: ExportedComponent): string {
    const { name } = component;
    const jsxRoot = getReturnJSX(component.node);

    const dartWidget = jsxRoot
      ? this.visitJSX(jsxRoot, null)
      : 'const Placeholder()';

    return [
      `class ${name} extends StatelessWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      `    return ${dartWidget};`,
      `  }`,
      `}`,
    ].join('\n');
  }

  // -------------------------------------------------------------------------
  // StatefulWidget
  // -------------------------------------------------------------------------

  private genStatefulWidget(
    component: ExportedComponent,
    analysis: ReturnType<typeof analyzeHooks>,
  ): string {
    const { name } = component;
    const stateName = `_${name}State`;
    const jsxRoot = getReturnJSX(component.node);
    const dartWidget = jsxRoot
      ? this.visitJSX(jsxRoot, null)
      : 'const Placeholder()';

    const stateFields = analysis.stateVars
      .map((sv) => `  ${sv.dartType} ${sv.name} = ${sv.initializer};`)
      .join('\n');

    // Build initState if there are effects
    let initState = '';
    if (analysis.hasEffects) {
      const effectBody = analysis.effectBodies
        .map((b) => `    ${b}`)
        .join('\n');
      initState =
        [
          `  @override`,
          `  void initState() {`,
          `    super.initState();`,
          effectBody,
          `  }`,
        ].join('\n') + '\n';
    }

    // Build dispose if there are cleanups
    let dispose = '';
    const cleanups = analysis.effectCleanups.filter(Boolean);
    if (cleanups.length > 0) {
      const cleanupBody = cleanups.map((c) => `    ${c}();`).join('\n');
      dispose =
        [
          `  @override`,
          `  void dispose() {`,
          cleanupBody,
          `    super.dispose();`,
          `  }`,
        ].join('\n') + '\n';
    }

    return [
      `class ${name} extends StatefulWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  State<${name}> createState() => ${stateName}();`,
      `}`,
      ``,
      `class ${stateName} extends State<${name}> {`,
      stateFields,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      `    return ${dartWidget};`,
      `  }`,
      initState ? initState.trimEnd() : '',
      dispose ? dispose.trimEnd() : '',
      `}`,
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  // -------------------------------------------------------------------------
  // JSX visitor — core slot-aware logic
  // -------------------------------------------------------------------------

  visitJSX(
    node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
    parentWidgetName: string | null,
  ): string {
    if (ts.isJsxFragment(node)) {
      return this.visitFragment(node, parentWidgetName);
    }

    const tagName = ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(this.sourceFile)
      : node.tagName.getText(this.sourceFile);

    const attributes = ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;

    const children = ts.isJsxElement(node) ? [...node.children] : [];

    return this.buildWidgetCall(tagName, attributes, children);
  }

  private visitFragment(
    node: ts.JsxFragment,
    parentWidgetName: string | null,
  ): string {
    const children = [...node.children].filter(
      (c) => !ts.isJsxText(c) || c.getText(this.sourceFile).trim() !== '',
    );
    if (children.length === 1) {
      const child = children[0];
      if (
        ts.isJsxElement(child) ||
        ts.isJsxSelfClosingElement(child) ||
        ts.isJsxFragment(child)
      ) {
        return this.visitJSX(child, parentWidgetName);
      }
    }
    // Multiple children in a fragment — wrap in Column
    const childExprs = children
      .filter(
        (c): c is ts.JsxElement | ts.JsxSelfClosingElement =>
          ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c),
      )
      .map((c) => this.visitJSX(c, 'Column'));
    return `Column(children: [${childExprs.join(', ')}])`;
  }

  private buildWidgetCall(
    tagName: string,
    attributes: ts.JsxAttributes,
    children: ts.JsxChild[],
  ): string {
    const props = this.extractProps(attributes);
    const parts: string[] = [];

    // --- Handle string props already encoded as named params
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') continue; // handled below
      parts.push(`${key}: ${value}`);
    }

    // --- Handle children
    const meaningfulChildren = children.filter((c) => {
      if (ts.isJsxText(c)) {
        return c.getText(this.sourceFile).trim() !== '';
      }
      return true;
    });

    if (meaningfulChildren.length > 0) {
      const childSlot = CHILD_SLOT_MAP.get(tagName);

      if (tagName === 'Text') {
        // Text: children become positional string arg
        const textContent = this.extractTextChildren(meaningfulChildren);
        if (textContent) {
          return `Text(${textContent}${parts.length > 0 ? ', ' + parts.join(', ') : ''})`;
        }
      } else if (childSlot === 'children') {
        // Multi-child slot — extract self-slots then collect the rest as array
        const { slottedArgs, unslottedChildren } = this.visitChildrenWithSlots(
          meaningfulChildren,
          tagName,
        );
        parts.push(...slottedArgs);
        if (unslottedChildren.length > 0) {
          parts.push(`children: [${unslottedChildren.join(', ')}]`);
        }
      } else if (childSlot) {
        // Named single-child slot (child / body / home / title / …)
        // Self-slotted siblings (AppBar → appBar:, FAB → floatingActionButton:)
        // must be extracted first, then the remaining child fills the named slot.
        const { slottedArgs, unslottedChildren } = this.visitChildrenWithSlots(
          meaningfulChildren,
          tagName,
        );
        parts.push(...slottedArgs);
        if (unslottedChildren.length > 0) {
          parts.push(`${childSlot}: ${unslottedChildren[0]}`);
        }
      } else {
        // Unknown widget — extract self-slots then fall back to children array
        const { slottedArgs, unslottedChildren } = this.visitChildrenWithSlots(
          meaningfulChildren,
          tagName,
        );
        parts.push(...slottedArgs);
        if (unslottedChildren.length > 0) {
          parts.push(`children: [${unslottedChildren.join(', ')}]`);
        }
      }
    }

    if (parts.length === 0) {
      return `${tagName}()`;
    }
    return `${tagName}(${parts.join(', ')})`;
  }

  /**
   * Separates children into those with self-slots (like AppBar → appBar:)
   * and those without (regular children:[]).
   */
  private visitChildrenWithSlots(
    children: ts.JsxChild[],
    parentWidget: string,
  ): { slottedArgs: string[]; unslottedChildren: string[] } {
    const slottedArgs: string[] = [];
    const unslottedChildren: string[] = [];

    for (const child of children) {
      if (ts.isJsxText(child)) {
        const text = child.getText(this.sourceFile).trim();
        if (text) unslottedChildren.push(dartString(text));
        continue;
      }

      if (ts.isJsxExpression(child)) {
        const expr = child.expression;
        if (expr) {
          unslottedChildren.push(this.transformExpression(expr));
        }
        continue;
      }

      if (
        ts.isJsxElement(child) ||
        ts.isJsxSelfClosingElement(child) ||
        ts.isJsxFragment(child)
      ) {
        const childTagName = ts.isJsxFragment(child)
          ? null
          : ts.isJsxElement(child)
            ? child.openingElement.tagName.getText(this.sourceFile)
            : child.tagName.getText(this.sourceFile);

        const selfSlot = childTagName ? SELF_SLOT_MAP.get(childTagName) : null;

        if (selfSlot) {
          const dartChild = this.visitJSX(child, parentWidget);
          slottedArgs.push(`${selfSlot}: ${dartChild}`);
        } else {
          const dartChild = this.visitJSX(child, parentWidget);
          unslottedChildren.push(dartChild);
        }
      }
    }

    return { slottedArgs, unslottedChildren };
  }

  private extractTextChildren(children: ts.JsxChild[]): string | null {
    const parts: string[] = [];

    for (const child of children) {
      if (ts.isJsxText(child)) {
        const text = child.getText(this.sourceFile).trim();
        if (text) parts.push(dartString(text));
      } else if (ts.isJsxExpression(child)) {
        const expr = child.expression;
        if (expr) {
          if (ts.isTemplateLiteral(expr)) {
            parts.push(this.transformTemplateLiteral(expr));
          } else {
            const exprText = expr.getText(this.sourceFile);
            parts.push(`'\${${exprText}}'`);
          }
        }
      }
    }

    return parts.length > 0 ? parts.join(' + ') : null;
  }

  // -------------------------------------------------------------------------
  // Props extraction
  // -------------------------------------------------------------------------

  private extractProps(attributes: ts.JsxAttributes): Record<string, string> {
    const result: Record<string, string> = {};

    for (const attr of attributes.properties) {
      if (ts.isJsxSpreadAttribute(attr)) continue;

      const name = attr.name.getText(this.sourceFile);
      const { initializer } = attr;

      if (!initializer) {
        // Boolean shorthand: <Widget disabled />
        result[name] = 'true';
        continue;
      }

      if (ts.isStringLiteral(initializer)) {
        result[name] = this.transformPropValue(name, initializer.text);
        continue;
      }

      if (ts.isJsxExpression(initializer)) {
        const expr = initializer.expression;
        if (!expr) continue;
        result[name] = this.transformPropValue(name, expr, true);
      }
    }

    return result;
  }

  private transformPropValue(
    propName: string,
    value: string | ts.Expression,
    isExpr = false,
  ): string {
    const raw =
      typeof value === 'string' ? value : value.getText(this.sourceFile);

    // Color props
    if (
      propName.toLowerCase().includes('color') ||
      propName === 'backgroundColor' ||
      propName === 'activeColor'
    ) {
      if (typeof value === 'string') return transformColor(value);
    }

    // Padding / margin
    if (propName === 'padding' || propName === 'margin') {
      if (typeof value === 'string')
        return transformPadding(Number(value) || value);
      // Array literal from expression
      if (isExpr && ts.isArrayLiteralExpression(value as ts.Expression)) {
        const arr = (value as ts.ArrayLiteralExpression).elements.map((e) =>
          parseFloat(e.getText(this.sourceFile)),
        );
        return transformPadding(arr);
      }
    }

    // Callback props: onClick, onChange, etc.
    if (propName.startsWith('on') && isExpr) {
      return this.transformCallbackExpr(value as ts.Expression);
    }

    // String literal
    if (typeof value === 'string') return dartString(value);

    // Boolean literal
    if (raw === 'true' || raw === 'false') return raw;

    // Numeric literal
    if (!isNaN(Number(raw))) return raw;

    // style object
    if (
      propName === 'style' &&
      isExpr &&
      ts.isObjectLiteralExpression(value as ts.Expression)
    ) {
      return this.transformStyleObject(value as ts.ObjectLiteralExpression);
    }

    // Template literal — convert ${x} to Dart interpolation
    if (isExpr && ts.isTemplateLiteral(value as ts.Expression)) {
      return this.transformTemplateLiteral(value as ts.TemplateLiteral);
    }

    // Identifier (variable reference)
    if (isExpr && ts.isIdentifier(value as ts.Expression)) {
      return raw;
    }

    // Default: return raw expression
    return isExpr ? raw : dartString(raw);
  }

  private transformCallbackExpr(expr: ts.Expression): string {
    const src = this.sourceFile;

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
      const { body } = expr;

      const transformed = this.transformCallbackBody(body);
      return `() { ${transformed} }`;
    }

    // Identifier: pass-through
    if (ts.isIdentifier(expr)) {
      return expr.getText(src);
    }

    return `() { ${expr.getText(src)}; }`;
  }

  private transformCallbackBody(body: ts.ConciseBody): string {
    if (!ts.isBlock(body)) {
      // Concise arrow body: () => setCount(count + 1)
      return this.transformStatement(body);
    }

    const stmts = body.statements
      .map((s) => this.transformStatement(s))
      .join(' ');
    return stmts;
  }

  private transformStatement(node: ts.Node): string {
    const src = this.sourceFile;

    // setX(value) → setState(() { x = value; })
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(src);
      if (this.stateSetterNames.has(callee) && node.arguments.length === 1) {
        const varName = this.getStateVarForSetter(callee);
        if (!varName) return node.getText(src) + ';';
        const argExpr = node.arguments[0];
        const argText = argExpr.getText(src);

        // Arrow updater: setCount((prev) => prev + 1)
        if (ts.isArrowFunction(argExpr) && argExpr.parameters.length === 1) {
          const paramName = argExpr.parameters[0].name.getText(src);
          const bodyText = argExpr.body.getText(src);
          const replaced = bodyText.replace(
            new RegExp(`\\b${paramName}\\b`, 'g'),
            varName,
          );
          return `setState(() { ${varName} = ${replaced}; });`;
        }

        return `setState(() { ${varName} = ${argText}; });`;
      }
    }

    // ExpressionStatement wrapping a call
    if (ts.isExpressionStatement(node)) {
      return this.transformStatement(node.expression);
    }

    return node.getText(src) + ';';
  }

  private getStateVarForSetter(setterName: string): string | null {
    // Convention: setCount → count, setMyValue → myValue
    const withoutSet = setterName.slice(3);
    const varName = withoutSet.charAt(0).toLowerCase() + withoutSet.slice(1);
    if (this.stateVarNames.has(varName)) return varName;
    // Brute force: find which var has this setter
    return null;
  }

  private transformStyleObject(obj: ts.ObjectLiteralExpression): string {
    const styleMap: Record<string, unknown> = {};
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const key = prop.name.getText(this.sourceFile);
        const val = prop.initializer.getText(this.sourceFile);
        styleMap[key] = val.replace(/^['"]|['"]$/g, ''); // strip quotes
      }
    }
    return transformTextStyle(styleMap);
  }

  private transformTemplateLiteral(node: ts.TemplateLiteral): string {
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return dartString(node.text);
    }

    const parts: string[] = [];
    parts.push(node.head.text);

    for (const span of node.templateSpans) {
      const exprText = span.expression.getText(this.sourceFile);
      parts.push(`\${${exprText}}`);
      parts.push(span.literal.text);
    }

    return `'${parts.join('')}'`;
  }

  private transformExpression(expr: ts.Expression): string {
    const src = this.sourceFile;

    if (ts.isStringLiteral(expr)) return dartString(expr.text);
    if (ts.isNumericLiteral(expr)) return expr.text;
    if (
      ts.isJsxElement(expr as unknown as ts.Node) ||
      ts.isJsxSelfClosingElement(expr as unknown as ts.Node)
    ) {
      return this.visitJSX(
        expr as unknown as ts.JsxElement | ts.JsxSelfClosingElement,
        null,
      );
    }

    return expr.getText(src);
  }
}

// ---------------------------------------------------------------------------
// File-level codegen
// ---------------------------------------------------------------------------

export const generateDartFile = (
  sourceFile: ts.SourceFile,
  components: ExportedComponent[],
): string => {
  const ctx = new CodegenContext(sourceFile);

  const parts: string[] = [
    `// GENERATED — do not edit. Source: ${sourceFile.fileName}`,
    `import 'package:flutter/material.dart';`,
    ``,
  ];

  for (const component of components) {
    parts.push(ctx.generateComponent(component));
    parts.push('');
  }

  return parts.join('\n');
};
