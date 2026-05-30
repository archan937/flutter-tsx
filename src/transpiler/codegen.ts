import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

import { CHILD_SLOT_MAP, SELF_SLOT_MAP } from '../generated/slot-map.js';
import { WIDGET_MAP } from '../generated/widget-map.js';
import {
  dartString,
  transformColor,
  transformPadding,
  transformTextStyle,
} from './dart-helpers.js';
import {
  analyzeHooks,
  type HandlerDef,
  type PluginUsage,
} from './hooks-analyzer.js';
import {
  tryTransformAndExpression,
  tryTransformMapCall,
  tryTransformTernary,
} from './jsx-control-flow.js';
import { type ExportedComponent, getFunctionBody } from './parser.js';

// ---------------------------------------------------------------------------
// DartCodegen spec — loaded from ref/derived/plugins-codegen.json at runtime
// ---------------------------------------------------------------------------

interface DartCodegen {
  imports: string[];
  controllerField?: string;
  initState?: string;
  dispose?: string;
  methods?: Record<string, string>;
  expression?: string;
}

const loadCodegenMap = (): Record<string, DartCodegen> => {
  try {
    const jsonPath = join(
      import.meta.dir,
      '..',
      '..',
      'ref',
      'derived',
      'plugins-codegen.json',
    );
    return JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<
      string,
      DartCodegen
    >;
  } catch {
    return {};
  }
};

const PLUGIN_CODEGEN_MAP: Record<string, DartCodegen> = loadCodegenMap();

// ---------------------------------------------------------------------------
// Plugin arg substitution helper
// ---------------------------------------------------------------------------

const substitutePluginArgs = (
  template: string,
  args: readonly ts.Expression[],
  sourceFile: ts.SourceFile,
): string => {
  let result = template;

  args.forEach((arg, idx) => {
    // Replace $N.key patterns (object literal property access)
    result = result.replace(
      new RegExp(`\\$${idx}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'),
      (_match, key: string) => {
        if (ts.isObjectLiteralExpression(arg)) {
          const prop = arg.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) && p.name.getText(sourceFile) === key,
          );
          if (prop) return prop.initializer.getText(sourceFile);
        }
        return `${arg.getText(sourceFile)}.${key}`;
      },
    );
    // Replace bare $N
    result = result.replace(
      new RegExp(`\\$${idx}(?![.\\w])`, 'g'),
      arg.getText(sourceFile),
    );
  });

  return result;
};

// ---------------------------------------------------------------------------
// CodegenContext
// ---------------------------------------------------------------------------

export interface CodegenOptions {
  /** Identifier → emitted Dart file, for cross-file component imports. */
  localComponents?: Map<string, string>;
  /**
   * Extra props (e.g. `theme`, `darkTheme`) to inject into the `<MaterialApp>`
   * call when the developer hasn't set them — sourced from config/theme.ts.
   */
  materialAppProps?: Record<string, string>;
  /** File uses `useTranslations` → import the generated `l10n.dart` (global `t`). */
  usesTranslations?: boolean;
}

export class CodegenContext {
  private sourceFile: ts.SourceFile;
  private stateVarNames = new Set<string>();
  private stateSetterNames = new Set<string>();
  private stateSetterToVar = new Map<string, string>();
  readonly imports = new Set<string>(['package:flutter/material.dart']);
  private pluginFields: string[] = [];
  private pluginInitState: string[] = [];
  private pluginDispose: string[] = [];
  private pluginVarNames = new Set<string>();
  private pluginMethods = new Map<string, Record<string, string>>();
  private handlerFunctionNames = new Set<string>();
  private readonly localComponents: Map<string, string>;
  private readonly materialAppProps: Record<string, string>;

  constructor(sourceFile: ts.SourceFile, options: CodegenOptions = {}) {
    this.sourceFile = sourceFile;
    this.localComponents = options.localComponents ?? new Map();
    this.materialAppProps = options.materialAppProps ?? {};
    if (options.usesTranslations) this.imports.add('l10n.dart');
  }

  // -------------------------------------------------------------------------
  // Component entry point
  // -------------------------------------------------------------------------

  generateComponent(component: ExportedComponent): string {
    const body = getFunctionBody(component.node);

    if (body && ts.isBlock(body)) {
      const analysis = analyzeHooks(body, this.sourceFile);
      const hasState = analysis.stateVars.length > 0;
      const hasPlugins = analysis.pluginUsages.length > 0;

      for (const sv of analysis.stateVars) {
        this.stateVarNames.add(sv.name);
        this.stateSetterNames.add(sv.setter);
        this.stateSetterToVar.set(sv.setter, sv.name);
      }

      for (const h of analysis.handlerFunctions) {
        this.handlerFunctionNames.add(h.name);
      }

      this.applyPluginUsages(analysis.pluginUsages);

      if (hasState || hasPlugins) {
        return this.genStatefulWidget(component, analysis);
      }
    }

    return this.genStatelessWidget(component);
  }

  private applyPluginUsages(usages: PluginUsage[]): void {
    for (const usage of usages) {
      const codegen = PLUGIN_CODEGEN_MAP[usage.hookName];
      if (!codegen) continue;

      for (const imp of codegen.imports) {
        const bare = imp
          .replace(/^import\s+'/, '')
          .replace(/';$/, '')
          .replace(/'\s*as\s+\w+/, '');
        this.imports.add(bare);
      }

      if (codegen.controllerField) {
        this.pluginFields.push(`  ${codegen.controllerField}`);
      }

      if (codegen.initState) {
        this.pluginInitState.push(codegen.initState);
      }

      if (codegen.dispose) {
        this.pluginDispose.push(codegen.dispose);
      }

      this.pluginVarNames.add(usage.varName);

      if (codegen.methods) {
        this.pluginMethods.set(usage.varName, codegen.methods);
      }
    }
  }

  // -------------------------------------------------------------------------
  // StatelessWidget
  // -------------------------------------------------------------------------

  private genStatelessWidget(component: ExportedComponent): string {
    const { name } = component;

    return [
      `class ${name} extends StatelessWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      this.buildMethodBody(component),
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

    const stateVarFields = analysis.stateVars
      .map((sv) => `  ${sv.dartType} ${sv.name} = ${sv.initializer};`)
      .join('\n');

    const allFields = [stateVarFields, ...this.pluginFields]
      .filter(Boolean)
      .join('\n');

    // Build initState if there are effects or plugin initState bodies
    const effectInitLines = analysis.hasEffects
      ? analysis.effectStatements.flatMap((stmts, i) =>
          stmts.length > 0
            ? stmts.map((s) => `    ${this.transformStatement(s)}`)
            : [`    ${analysis.effectBodies[i]}`],
        )
      : [];
    const pluginInitLines = this.pluginInitState.map((b) =>
      b
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n'),
    );
    const allInitLines = [...effectInitLines, ...pluginInitLines];

    let initState = '';
    if (allInitLines.length > 0) {
      initState =
        [
          `  @override`,
          `  void initState() {`,
          `    super.initState();`,
          allInitLines.join('\n'),
          `  }`,
        ].join('\n') + '\n';
    }

    // Build dispose if there are cleanups or plugin dispose bodies
    const cleanups = analysis.effectCleanups.filter(Boolean);
    const allDisposeBodies = [
      ...cleanups.map((c) => `    ${c}();`),
      ...this.pluginDispose.map((d) => `    ${d}`),
    ];

    let dispose = '';
    if (allDisposeBodies.length > 0) {
      dispose =
        [
          `  @override`,
          `  void dispose() {`,
          allDisposeBodies.join('\n'),
          `    super.dispose();`,
          `  }`,
        ].join('\n') + '\n';
    }

    const handlerMethods = analysis.handlerFunctions
      .map((h) => this.emitHandlerMethod(h))
      .join('\n');

    return [
      `class ${name} extends StatefulWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  State<${name}> createState() => ${stateName}();`,
      `}`,
      ``,
      `class ${stateName} extends State<${name}> {`,
      allFields,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      this.buildMethodBody(component),
      `  }`,
      initState ? initState.trimEnd() : '',
      dispose ? dispose.trimEnd() : '',
      handlerMethods || '',
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
    // A reference to a component imported from a relative module needs a Dart
    // import so the generated file can construct it. Output is flat, so the
    // import path is just the basename .dart file.
    const localDartFile = this.localComponents.get(tagName);
    if (localDartFile && !WIDGET_MAP.has(tagName)) {
      this.imports.add(localDartFile);
    }

    const props = this.extractProps(attributes, tagName);
    const parts: string[] = [];

    // --- Handle string props already encoded as named params
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') continue; // handled below
      parts.push(`${key}: ${value}`);
    }

    // --- Inject surface-derived props (e.g. theme/darkTheme from config/theme.ts)
    // into MaterialApp, unless the developer already set them in TSX.
    if (tagName === 'MaterialApp') {
      for (const [key, value] of Object.entries(this.materialAppProps)) {
        if (key in props) continue;
        parts.push(`${key}: ${value}`);
      }
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
        if (unslottedChildren.length > 1) {
          throw new Error(
            `[fsx] <${tagName}> accepts a single child (slot '${childSlot}') but received ${unslottedChildren.length}. ` +
              `Wrap them in a layout widget such as <Column>, <Row>, or <ListView>.`,
          );
        }
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
        if (text) unslottedChildren.push(`Text(${dartString(text)})`);
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
  // Build method body — supports early returns and control-flow returns
  // -------------------------------------------------------------------------

  private buildMethodBody(component: ExportedComponent): string {
    const body = getFunctionBody(component.node);
    if (!body) return '    return const Placeholder();';

    if (!ts.isBlock(body)) {
      return `    return ${this.transformReturnExpr(body)};`;
    }

    const lines: string[] = [];
    for (const stmt of body.statements) {
      if (ts.isReturnStatement(stmt) && stmt.expression) {
        lines.push(`    return ${this.transformReturnExpr(stmt.expression)};`);
      } else if (ts.isIfStatement(stmt)) {
        const guardText = stmt.expression.getText(this.sourceFile);
        const thenReturn = this.extractGuardReturn(stmt.thenStatement);
        if (thenReturn !== null) {
          lines.push(`    if (${guardText}) return ${thenReturn};`);
        }
      }
    }

    return lines.length > 0
      ? lines.join('\n')
      : '    return const Placeholder();';
  }

  private extractGuardReturn(stmt: ts.Statement): string | null {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      return this.transformReturnExpr(stmt.expression);
    }
    if (
      ts.isBlock(stmt) &&
      stmt.statements.length === 1 &&
      ts.isReturnStatement(stmt.statements[0]) &&
      stmt.statements[0].expression
    ) {
      return this.transformReturnExpr(stmt.statements[0].expression);
    }
    return null;
  }

  private transformReturnExpr(expr: ts.Expression): string {
    if (ts.isParenthesizedExpression(expr)) {
      return this.transformReturnExpr(expr.expression);
    }
    if (
      ts.isJsxElement(expr) ||
      ts.isJsxSelfClosingElement(expr) ||
      ts.isJsxFragment(expr)
    ) {
      return this.visitJSX(expr, null);
    }
    if (ts.isConditionalExpression(expr)) {
      const result = tryTransformTernary(expr, this.sourceFile, (n) =>
        this.visitJSX(n, null),
      );
      if (result) return result;
    }
    return 'const Placeholder()';
  }

  // -------------------------------------------------------------------------
  // Props extraction
  // -------------------------------------------------------------------------

  private extractProps(
    attributes: ts.JsxAttributes,
    tagName: string,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const attr of attributes.properties) {
      if (ts.isJsxSpreadAttribute(attr)) continue;

      const tsxName = attr.name.getText(this.sourceFile);
      if (tsxName === 'key') continue; // React-only reserved prop

      const widgetDef = WIDGET_MAP.get(tagName);
      const propDef =
        widgetDef?.props.find((p) => p.tsxProp === tsxName) ??
        widgetDef?.styling.find((p) => p.tsxProp === tsxName);
      const dartParam = propDef?.dartParam ?? tsxName;
      const { initializer } = attr;

      if (!initializer) {
        result[dartParam] = 'true';
        continue;
      }

      if (ts.isStringLiteral(initializer)) {
        // TextField.label is a convenience prop that maps to decoration: InputDecoration(labelText:...)
        const effectiveDartParam =
          tagName === 'TextField' && tsxName === 'label'
            ? 'decoration'
            : dartParam;
        result[effectiveDartParam] = this.transformStringProp(
          tagName,
          tsxName,
          initializer.text,
        );
        continue;
      }

      if (ts.isJsxExpression(initializer)) {
        const expr = initializer.expression;
        if (!expr) continue;
        result[dartParam] = this.transformExprProp(
          tsxName,
          expr,
          propDef?.transform === 'widget',
        );
      }
    }

    return result;
  }

  private transformStringProp(
    tagName: string,
    propName: string,
    value: string,
  ): string {
    if (
      propName.toLowerCase().includes('color') ||
      propName === 'backgroundColor' ||
      propName === 'activeColor'
    ) {
      return transformColor(value);
    }

    // A string assigned to a Widget-typed prop (e.g. AppBar.title,
    // ListTile.title) must be wrapped in a Text widget.
    const widgetTypedDef = WIDGET_MAP.get(tagName);
    const widgetTypedProp =
      widgetTypedDef?.props.find((p) => p.tsxProp === propName) ??
      widgetTypedDef?.styling.find((p) => p.tsxProp === propName);
    if (widgetTypedProp?.transform === 'widget') {
      return `Text(${dartString(value)})`;
    }

    // TextField label convenience prop → InputDecoration(labelText: ...)
    if (propName === 'label') {
      return `InputDecoration(labelText: ${dartString(value)})`;
    }

    if (propName === 'padding' || propName === 'margin') {
      return transformPadding(Number(value) || value);
    }

    // Enum props: look up the widget's prop definition to emit EnumClass.value
    const widgetDef = WIDGET_MAP.get(tagName);
    const propDef =
      widgetDef?.props.find((p) => p.tsxProp === propName) ??
      widgetDef?.styling.find((p) => p.tsxProp === propName);
    if (propDef?.transform === 'enum') {
      const enumClass = propDef.dartType.replace('?', '');
      return `${enumClass}.${value}`;
    }

    return dartString(value);
  }

  private transformExprProp(
    propName: string,
    expr: ts.Expression,
    isWidgetTyped = false,
  ): string {
    const raw = expr.getText(this.sourceFile);

    // JSX passed as a prop value (e.g. icon={<Icon name="home" />}) must be
    // transpiled to its Dart widget, not emitted as raw TSX.
    if (
      ts.isJsxElement(expr) ||
      ts.isJsxSelfClosingElement(expr) ||
      ts.isJsxFragment(expr)
    ) {
      return this.visitJSX(expr, null);
    }

    // A non-JSX value bound to a Widget-typed prop (e.g. ListTile title={item})
    // is a string-ish value that must be wrapped in a Text widget.
    if (
      isWidgetTyped &&
      (ts.isIdentifier(expr) ||
        ts.isPropertyAccessExpression(expr) ||
        ts.isStringLiteral(expr) ||
        ts.isTemplateExpression(expr))
    ) {
      if (ts.isStringLiteral(expr)) return `Text(${dartString(expr.text)})`;
      if (ts.isTemplateExpression(expr)) {
        return `Text(${this.transformTemplateLiteral(expr)})`;
      }
      return `Text(${raw})`;
    }

    if (
      propName.toLowerCase().includes('color') ||
      propName === 'backgroundColor' ||
      propName === 'activeColor'
    ) {
      if (ts.isStringLiteral(expr)) return transformColor(expr.text);
      return raw;
    }

    if (propName === 'padding' || propName === 'margin') {
      if (ts.isArrayLiteralExpression(expr)) {
        const arr = expr.elements.map((e) =>
          parseFloat(e.getText(this.sourceFile)),
        );
        return transformPadding(arr);
      }
    }

    if (propName.startsWith('on')) {
      return this.transformCallbackExpr(expr);
    }

    if (raw === 'true' || raw === 'false') return raw;

    if (raw.trim() !== '' && !isNaN(Number(raw))) return raw;

    if (propName === 'style' && ts.isObjectLiteralExpression(expr)) {
      return this.transformStyleObject(expr);
    }

    if (ts.isTemplateLiteral(expr)) {
      return this.transformTemplateLiteral(expr);
    }

    return raw;
  }

  private transformCallbackExpr(expr: ts.Expression): string {
    const src = this.sourceFile;

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
      const { parameters, body } = expr;

      // Form-input pattern: (e) => setX(e.target.value) → (value) { setState... }
      if (parameters.length === 1) {
        const paramName = parameters[0].name.getText(src);
        const bodyRaw = body.getText(src);
        if (bodyRaw.includes(`${paramName}.target.value`)) {
          const transformed = this.transformCallbackBody(body).replace(
            new RegExp(`\\b${paramName}\\.target\\.value\\b`, 'g'),
            'value',
          );
          return `(value) { ${transformed} }`;
        }
      }

      // General callback with parameters: (index) => setIdx(index) → (index) { ... }
      const paramList = parameters.map((p) => p.name.getText(src)).join(', ');
      const transformed = this.transformCallbackBody(body);
      return paramList
        ? `(${paramList}) { ${transformed} }`
        : `() { ${transformed} }`;
    }

    // Identifier: local handler → _handlerName; a bare useState setter passed
    // as a callback (e.g. onChanged={setName}) becomes a setState updater that
    // assigns the callback's argument; otherwise pass-through.
    if (ts.isIdentifier(expr)) {
      const name = expr.getText(src);
      if (this.handlerFunctionNames.has(name)) return `_${name}`;
      const stateVar = this.stateSetterToVar.get(name);
      if (stateVar) {
        return `(value) { setState(() { ${stateVar} = value; }); }`;
      }
      return name;
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

  private emitHandlerMethod(h: HandlerDef): string {
    const { body } = h.node;

    let bodyLines: string;
    if (ts.isBlock(body)) {
      bodyLines = body.statements
        .map((s) => `    ${this.transformStatement(s)}`)
        .join('\n');
    } else {
      bodyLines = `    ${this.transformStatement(body)}`;
    }

    // Auto-detect async: if any transformed line starts with 'await', the method must be async
    const needsAsync =
      h.isAsync ||
      bodyLines.split('\n').some((l) => l.trimStart().startsWith('await '));

    const returnType = needsAsync ? 'Future<void>' : 'void';
    const asyncKw = needsAsync ? ' async' : '';

    return [`  ${returnType} _${h.name}()${asyncKw} {`, bodyLines, `  }`].join(
      '\n',
    );
  }

  private transformStatement(node: ts.Node): string {
    const src = this.sourceFile;

    // Unwrap await: await expr → handle the inner expression
    if (ts.isAwaitExpression(node)) {
      return this.transformStatement(node.expression);
    }

    // pluginVar.method(args) → Dart template from pluginMethods map
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const obj = node.expression.expression.getText(src);
      const method = node.expression.name.getText(src);
      if (this.pluginVarNames.has(obj)) {
        const methods = this.pluginMethods.get(obj);
        if (methods?.[method]) {
          const template = methods[method];
          // Substitute $0, $1, ... and $0.key (object property access)
          const substituted = substitutePluginArgs(
            template,
            node.arguments,
            this.sourceFile,
          );
          return `${substituted};`;
        }
        // Unknown method on known plugin var — fall through to raw text
      }
    }

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
    const withoutSet = setterName.slice(3);
    const varName = withoutSet.charAt(0).toLowerCase() + withoutSet.slice(1);
    return this.stateVarNames.has(varName) ? varName : null;
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

    if (ts.isStringLiteral(expr)) return `Text(${dartString(expr.text)})`;
    if (ts.isNumericLiteral(expr)) return `Text('${expr.text}')`;
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr)) {
      return this.visitJSX(expr, null);
    }

    if (ts.isConditionalExpression(expr)) {
      const result = tryTransformTernary(expr, src, (n) =>
        this.visitJSX(n, null),
      );
      if (result) return result;
    }

    if (ts.isBinaryExpression(expr)) {
      const result = tryTransformAndExpression(expr, src, (n) =>
        this.visitJSX(n, null),
      );
      if (result) return result;
    }

    if (ts.isCallExpression(expr)) {
      const result = tryTransformMapCall(expr, src, (n) =>
        this.visitJSX(n, null),
      );
      if (result) return result;
    }

    return expr.getText(src);
  }
}

// ---------------------------------------------------------------------------
// File-level codegen
// ---------------------------------------------------------------------------

// Render a literal data element (string / number / boolean) to Dart. String
// literals go through dartString so `$` is escaped (Dart treats `$` as string
// interpolation). Returns null for anything that isn't a simple literal.
const literalToDart = (expr: ts.Expression): string | null => {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return dartString(expr.text);
  }
  if (ts.isNumericLiteral(expr)) return expr.text;
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return `-${expr.operand.text}`;
  }
  return null;
};

// Module-level `const NAME = [...]` data used by components (e.g. lists fed to
// .map()) is otherwise dropped, leaving undefined names in the Dart output.
// Emit such declarations as top-level Dart `final`s. Only simple primitives and
// arrays of primitives are supported; other shapes are skipped (the component
// author must inline them).
const collectDataConsts = (
  sourceFile: ts.SourceFile,
  componentNames: Set<string>,
): string[] => {
  const lines: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const name = decl.name.getText(sourceFile);
      if (componentNames.has(name)) continue;

      const init = decl.initializer;
      const primitive = literalToDart(init);
      if (primitive) {
        lines.push(`final ${name} = ${primitive};`);
        continue;
      }

      if (ts.isArrayLiteralExpression(init)) {
        const elements = init.elements.map(literalToDart);
        if (elements.every((e): e is string => e !== null)) {
          lines.push(`final ${name} = [${elements.join(', ')}];`);
        }
      }
    }
  }

  return lines;
};

const buildDartOutput = (
  sourceFile: ts.SourceFile,
  components: ExportedComponent[],
  options?: CodegenOptions,
): { code: string; ctx: CodegenContext } => {
  const ctx = new CodegenContext(sourceFile, options);

  const componentNames = new Set(components.map((c) => c.name));
  const dataConsts = collectDataConsts(sourceFile, componentNames);

  const componentBodies = components
    .map((c) => ctx.generateComponent(c))
    .filter(Boolean);

  const importLines = [...ctx.imports].map((i) => `import '${i}';`).join('\n');

  const parts: string[] = [
    `// GENERATED — do not edit. Source: ${sourceFile.fileName}`,
    importLines,
    ``,
    ...(dataConsts.length > 0 ? [dataConsts.join('\n'), ''] : []),
    ...componentBodies.flatMap((body, idx) =>
      idx < componentBodies.length - 1 ? [body, ''] : [body],
    ),
    '',
  ];

  return { code: parts.join('\n'), ctx };
};

export const generateDartFile = (
  sourceFile: ts.SourceFile,
  components: ExportedComponent[],
  options?: CodegenOptions,
): string => buildDartOutput(sourceFile, components, options).code;

export interface DartFileResult {
  code: string;
  imports: Set<string>;
}

export const generateDartFileResult = (
  sourceFile: ts.SourceFile,
  components: ExportedComponent[],
  options?: CodegenOptions,
): DartFileResult => {
  const { code, ctx } = buildDartOutput(sourceFile, components, options);
  return { code, imports: ctx.imports };
};
