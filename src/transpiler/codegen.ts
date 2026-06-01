import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

import { GENERATED_IGNORES } from '../dart-lint.js';
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
import {
  ANIMATED_TWIN,
  DEFAULT_ANIMATION_DURATION_MS,
  GESTURE_PROPS,
} from './widget-sugar.js';

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
  widget?: string;
  propMap?: Record<string, string>;
  render?: string;
  defaults?: Record<string, string>;
}

/**
 * Substitutes `$prop` tokens in a plugin-widget template with the JSX prop's
 * Dart value (already transformed), falling back to recipe defaults. Keeps all
 * per-widget Dart in the SDK-derived data — codegen stays generic.
 */
const substituteWidgetProps = (
  template: string,
  props: Record<string, string>,
  defaults: Record<string, string> = {},
): string =>
  template.replace(
    /\$([a-zA-Z][a-zA-Z0-9]*)/g,
    (_match, name: string) => props[name] ?? defaults[name] ?? "''",
  );

/** `import 'package:x/x.dart';` → bare `package:x/x.dart` (alias dropped). */
const stripImport = (dartImport: string): string =>
  dartImport
    .replace(/^import\s+'/, '')
    .replace(/';$/, '')
    .replace(/'\s*as\s+\w+/, '');

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

interface SubstituteArgsOptions {
  argToDart?: (arg: ts.Expression) => string;
  sourceFile?: ts.SourceFile;
}

const substitutePluginArgs = (
  template: string,
  args: readonly ts.Expression[],
  options: SubstituteArgsOptions = {},
): string => {
  const argToDart =
    options.argToDart ?? ((arg: ts.Expression): string => arg.getText());
  let result = template;
  // getText() with no args walks parent→SourceFile, which isn't always set on
  // CLI-parsed nodes; pass the sourceFile explicitly when we have it.
  const textOf = (node: ts.Node): string =>
    options.sourceFile ? node.getText(options.sourceFile) : node.getText();

  args.forEach((arg, idx) => {
    // Replace $N.key patterns (object literal property access)
    result = result.replace(
      new RegExp(`\\$${idx}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'),
      (_match, key: string) => {
        if (ts.isObjectLiteralExpression(arg)) {
          const prop = arg.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) && textOf(p.name) === key,
          );
          if (prop) return argToDart(prop.initializer);
        }
        return `${argToDart(arg)}.${key}`;
      },
    );
    // Replace bare $N (template literals → Dart string interpolation, etc.)
    result = result.replace(
      new RegExp(`\\$${idx}(?![.\\w])`, 'g'),
      argToDart(arg),
    );
  });

  return result;
};

/**
 * Dart string interpolation for an embedded expression. A bare identifier uses
 * the brace-free `$id` form (Dart's `unnecessary_brace_in_string_interps` lint
 * flags `${id}`); anything else (member access, calls) keeps `${…}`.
 */
const SIMPLE_DART_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const dartInterpolation = (exprText: string): string =>
  SIMPLE_DART_IDENTIFIER.test(exprText) ? `$${exprText}` : `\${${exprText}}`;

/** A closure whose transpiled body awaits must be declared `async`. */
const asyncKeyword = (body: string): string =>
  /\bawait\s/.test(body) ? 'async ' : '';

/**
 * Library-private helper emitted into any file that calls `fetch(...)`. Private
 * (`_`-prefixed) names are library-scoped, so per-file copies never collide
 * across the flat output. `fetch(url)` is rewritten to `_fsxFetch(url)`.
 */
const FETCH_HELPER = `class _FetchResponse {
  final bool ok;
  final int status;
  final String body;
  const _FetchResponse(this.ok, this.status, this.body);
  dynamic get json => jsonDecode(body);
}

Future<_FetchResponse> _fsxFetch(String url) async {
  final res = await get(Uri.parse(url));
  return _FetchResponse(
    res.statusCode >= 200 && res.statusCode < 300,
    res.statusCode,
    res.body,
  );
}`;
const HTTP_IMPORT = 'package:http/http.dart';

// ---------------------------------------------------------------------------
// Feature-function codegen — top-level functions (launchUrl, share, pickFile,
// clipboard.*, hapticFeedback.*, systemChrome.*, loadAsset, appDir, tempDir).
// Templates use the $0/$1/$0.key arg-substitution convention. `fetch` is
// excluded (handled specially via rewriteFetchCall + the _fsxFetch helper).
// ---------------------------------------------------------------------------

interface FeatureFunction {
  dart: string;
  dartImport?: string;
}

const loadFunctionMap = (): Record<string, FeatureFunction> => {
  try {
    const jsonPath = join(
      import.meta.dir,
      '..',
      '..',
      'ref',
      'derived',
      'functions.json',
    );
    const arr = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
      name?: string;
      tsxName?: string;
      dart?: string;
      dartImport?: string;
    }[];
    const map: Record<string, FeatureFunction> = {};
    for (const fn of arr) {
      const key = fn.tsxName ?? fn.name;
      if (key && key !== 'fetch' && fn.dart) {
        map[key] = { dart: fn.dart, dartImport: fn.dartImport };
      }
    }
    return map;
  } catch {
    return {};
  }
};

const FUNCTION_MAP: Record<string, FeatureFunction> = loadFunctionMap();

/**
 * Plugin widgets whose codegen spec declares lifecycle state (controller field,
 * initState, or dispose) must render inside a StatefulWidget. Derived from the
 * data — adding a stateful plugin widget needs no code change here.
 */
const STATEFUL_PLUGIN_WIDGETS: readonly string[] = Object.entries(
  PLUGIN_CODEGEN_MAP,
)
  .filter(
    ([, spec]) =>
      (spec.render !== undefined || spec.widget !== undefined) &&
      Boolean(spec.controllerField ?? spec.initState ?? spec.dispose),
  )
  .map(([tagName]) => tagName);

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
  /**
   * File-based router: when set, a generated `<MaterialApp>` becomes
   * `MaterialApp.router(routerConfig: _fsxRouter, …)` and the `_fsxRouter` decl
   * + go_router/route imports are emitted into that file. `decl` is the
   * `buildGoRouter(...)` output; `imports` are the route components' Dart files.
   */
  router?: { decl: string; imports: string[] };
  /**
   * Names of `createStore` hooks (e.g. `useCounter`) visible to this file,
   * including those defined in other files. A `const { … } = useCounter()` call
   * to one of these is rewritten to a `context.watch<CounterStore>()` binding.
   */
  storeHooks?: ReadonlySet<string>;
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
  private readonly router?: { decl: string; imports: string[] };
  private readonly storeHooks: ReadonlySet<string>;
  routerUsed = false;
  storesUsed = false;
  usesFetch = false;
  /** Generated `_FsxTabsN` StatefulWidget classes, one per `<TabView>` usage. */
  readonly tabWidgets: string[] = [];

  constructor(sourceFile: ts.SourceFile, options: CodegenOptions = {}) {
    this.sourceFile = sourceFile;
    this.localComponents = options.localComponents ?? new Map();
    this.materialAppProps = options.materialAppProps ?? {};
    this.router = options.router;
    this.storeHooks = options.storeHooks ?? new Set();
    if (options.usesTranslations) this.imports.add('l10n.dart');
  }

  /** The `_fsxRouter` decl to prepend, iff this file emitted a MaterialApp.router. */
  routerDecl(): string | null {
    return this.routerUsed && this.router ? this.router.decl : null;
  }

  // -------------------------------------------------------------------------
  // Component entry point
  // -------------------------------------------------------------------------

  generateComponent(component: ExportedComponent): string {
    const body = getFunctionBody(component.node);
    let handlers: HandlerDef[] = [];

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

      // Controller-backed plugin widgets need StatefulWidget (controller field +
      // initState), even with no useState/hook.
      const bodyText = body.getText(this.sourceFile);
      const usesStatefulPluginWidget = STATEFUL_PLUGIN_WIDGETS.some((w) =>
        bodyText.includes(`<${w}`),
      );

      if (hasState || hasPlugins || usesStatefulPluginWidget) {
        return this.genStatefulWidget(component, analysis);
      }
      // No state/plugins, but named handlers still need method bodies on the
      // StatelessWidget (otherwise `onPressed: _go` dangles).
      handlers = analysis.handlerFunctions;
    }

    return this.genStatelessWidget(component, handlers);
  }

  private applyPluginUsages(usages: PluginUsage[]): void {
    for (const usage of usages) {
      const codegen = PLUGIN_CODEGEN_MAP[usage.hookName];
      if (!codegen) continue;

      for (const imp of codegen.imports) {
        this.imports.add(stripImport(imp));
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

  private genStatelessWidget(
    component: ExportedComponent,
    handlers: HandlerDef[] = [],
  ): string {
    const { name } = component;
    const handlerMethods = handlers
      .map((h) => this.emitHandlerMethod(h))
      .join('\n');

    return [
      `class ${name} extends StatelessWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      this.buildMethodBody(component),
      `  }`,
      handlerMethods || '',
      `}`,
    ]
      .filter((l) => l !== '')
      .join('\n');
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

    // Build the body FIRST: rendering plugin widgets (GoogleMap/WebView/…) pushes
    // their controller field + initState, which the field/initState assembly below
    // must then pick up.
    const bodyDart = this.buildMethodBody(component);

    const stateVarFields = analysis.stateVars
      .map((sv) => `  ${sv.dartType} ${sv.name} = ${sv.initializer};`)
      .join('\n');

    // dedup: a controller field can be pushed by both a hook (useMapController)
    // and its widget (<GoogleMap>) in the same component.
    const allFields = [...new Set([stateVarFields, ...this.pluginFields])]
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
      bodyDart,
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

    if (tagName === 'TabView') return this.buildTabView(attributes);

    const children = ts.isJsxElement(node) ? [...node.children] : [];

    return this.buildWidgetCall(tagName, attributes, children);
  }

  /**
   * `<TabView tabs={[{label, icon, screen}, …]} />` → a reference to a generated
   * library-private `_FsxTabsN` StatefulWidget (Scaffold + BottomNavigationBar +
   * IndexedStack, preserving tab state). The class is collected for file emission.
   */
  private buildTabView(attributes: ts.JsxAttributes): string {
    const src = this.sourceFile;
    const tabsAttr = attributes.properties.find(
      (p): p is ts.JsxAttribute =>
        ts.isJsxAttribute(p) && p.name.getText(src) === 'tabs',
    );

    const screens: string[] = [];
    const items: string[] = [];
    const arr =
      tabsAttr?.initializer && ts.isJsxExpression(tabsAttr.initializer)
        ? tabsAttr.initializer.expression
        : undefined;
    if (arr && ts.isArrayLiteralExpression(arr)) {
      for (const el of arr.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue;
        const prop = (key: string): ts.Expression | undefined =>
          el.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) && p.name.getText(src) === key,
          )?.initializer;
        const label = prop('label');
        const icon = prop('icon');
        const screen = prop('screen');
        const labelText = label && ts.isStringLiteral(label) ? label.text : '';
        const iconText =
          icon && ts.isStringLiteral(icon) ? icon.text : 'circle';
        screens.push(
          screen ? this.transformReturnExpr(screen) : 'const SizedBox.shrink()',
        );
        items.push(
          `BottomNavigationBarItem(icon: Icon(Icons.${iconText}), label: '${labelText}')`,
        );
      }
    }

    const name = `_FsxTabs${this.tabWidgets.length}`;
    const cls = [
      `class ${name} extends StatefulWidget {`,
      `  const ${name}({super.key});`,
      `  @override`,
      `  State<${name}> createState() => ${name}State();`,
      `}`,
      ``,
      `class ${name}State extends State<${name}> {`,
      `  int _index = 0;`,
      `  @override`,
      `  Widget build(BuildContext context) {`,
      `    return Scaffold(`,
      `      body: IndexedStack(index: _index, children: [${screens.join(', ')}]),`,
      `      bottomNavigationBar: BottomNavigationBar(`,
      `        currentIndex: _index,`,
      `        onTap: (i) => setState(() => _index = i),`,
      `        items: const [${items.join(', ')}],`,
      `      ),`,
      `    );`,
      `  }`,
      `}`,
    ].join('\n');
    this.tabWidgets.push(cls);
    return `${name}()`;
  }

  /**
   * `showSheet(<X/>)` → `showModalBottomSheet(...)`, `showDialog(<X/>)` →
   * `showDialog(...)`. Returns the Dart call (no trailing `;`), or null.
   */
  private rewriteModalCall(node: ts.CallExpression): string | null {
    const callee = node.expression.getText(this.sourceFile);
    const builder =
      callee === 'showSheet'
        ? 'showModalBottomSheet'
        : callee === 'showDialog'
          ? 'showDialog'
          : null;
    if (!builder) return null;
    const arg = node.arguments[0];
    const child =
      arg &&
      (ts.isJsxElement(arg) ||
        ts.isJsxSelfClosingElement(arg) ||
        ts.isJsxFragment(arg))
        ? this.visitJSX(arg, null)
        : (arg?.getText(this.sourceFile) ?? 'const SizedBox.shrink()');
    return `${builder}(context: context, builder: (context) => ${child})`;
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
    // `animate` swaps the tag for its Animated* twin (mutating props in place);
    // gesture props are pulled out to wrap the result in a GestureDetector when
    // the widget doesn't support them natively.
    const emitTag = this.applyAnimate(tagName, props);
    const gestureProps = this.extractGestureProps(tagName, props);

    // Plugin widgets (CachedNetworkImage, …) render via a dedicated template
    // (correct Dart class + constructor params) and register their import.
    const pluginWidget = this.tryPluginWidget(tagName, props);
    if (pluginWidget !== null) {
      return this.wrapGestures(pluginWidget, gestureProps);
    }

    const parts: string[] = [];

    // --- Handle string props already encoded as named params
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') continue; // handled below
      if (key in gestureProps) continue; // pulled out for the GestureDetector wrapper
      // `<MaterialApp routes="./routes">` is the fsx file-based-routing directive,
      // not a Flutter prop — it drives MaterialApp.router, never emitted as `routes:`.
      if (tagName === 'MaterialApp' && key === 'routes') continue;
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

    // --- File-based routing: MaterialApp → MaterialApp.router(routerConfig: …).
    // The router supplies the screens, so the home child is dropped.
    if (tagName === 'MaterialApp' && this.router) {
      this.routerUsed = true;
      this.imports.add('package:go_router/go_router.dart');
      for (const imp of this.router.imports) this.imports.add(imp);
      return `MaterialApp.router(routerConfig: _fsxRouter${parts.length > 0 ? ', ' + parts.join(', ') : ''})`;
    }

    // --- Handle children
    const meaningfulChildren = children.filter((c) => {
      if (ts.isJsxText(c)) {
        return c.getText(this.sourceFile).trim() !== '';
      }
      return true;
    });

    if (meaningfulChildren.length > 0) {
      const childSlot = CHILD_SLOT_MAP.get(emitTag);

      if (tagName === 'Text') {
        // Text: children become positional string arg
        const textContent = this.extractTextChildren(meaningfulChildren);
        if (textContent) {
          return this.wrapGestures(
            `Text(${textContent}${parts.length > 0 ? ', ' + parts.join(', ') : ''})`,
            gestureProps,
          );
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
      return this.wrapGestures(`${emitTag}()`, gestureProps);
    }
    return this.wrapGestures(`${emitTag}(${parts.join(', ')})`, gestureProps);
  }

  /**
   * If `animate` is set, swaps the tag for its Animated* twin (consuming the
   * `animate` flag and normalising `duration`/`curve`), mutating `props`.
   * Returns the Dart class name to emit. Throws for non-animatable widgets.
   */
  private applyAnimate(tagName: string, props: Record<string, string>): string {
    if (!('animate' in props)) return tagName;
    delete props.animate;

    const twin = ANIMATED_TWIN[tagName];
    if (!twin) {
      throw new Error(
        `[fsx] \`animate\` is not supported on <${tagName}>. ` +
          `Animatable widgets: ${Object.keys(ANIMATED_TWIN).join(', ')}.`,
      );
    }

    // duration: a bare number is milliseconds; default 300ms; anything else
    // (e.g. a Duration variable) is passed through untouched.
    if ('duration' in props) {
      const raw = props.duration.trim();
      if (/^\d+$/.test(raw)) props.duration = `Duration(milliseconds: ${raw})`;
    } else {
      props.duration = `Duration(milliseconds: ${DEFAULT_ANIMATION_DURATION_MS})`;
    }

    // curve: a string name → Curves.<name> (e.g. "easeInOut" → Curves.easeInOut).
    if ('curve' in props) {
      const named = props.curve.match(/^'([A-Za-z][A-Za-z0-9]*)'$/);
      if (named) props.curve = `Curves.${named[1]}`;
    }

    return twin;
  }

  /**
   * Pulls gesture props (onTap/onDoubleTap/onLongPress) that the widget does NOT
   * declare natively out of `props`, so the caller can wrap the widget in a
   * GestureDetector. Natively-supported gestures (GestureDetector, InkWell, …)
   * are left in place to pass straight through.
   */
  private extractGestureProps(
    tagName: string,
    props: Record<string, string>,
  ): Record<string, string> {
    const widgetDef = WIDGET_MAP.get(tagName);
    const out: Record<string, string> = {};
    for (const gesture of GESTURE_PROPS) {
      if (!(gesture in props)) continue;
      const native =
        (widgetDef?.props.some((p) => p.tsxProp === gesture) ?? false) ||
        (widgetDef?.styling.some((p) => p.tsxProp === gesture) ?? false);
      if (native) continue;
      out[gesture] = props[gesture];
    }
    return out;
  }

  /**
   * Renders a plugin widget to its real Flutter/plugin constructor (correct
   * class + param names) and registers the package import (→ pubspec dep).
   * Returns null for non-plugin widgets. CachedNetworkImage is stateless; the
   * controller-backed plugin widgets (GoogleMap/WebView/VideoPlayer) are handled
   * separately because they require StatefulWidget controller wiring.
   */
  private tryPluginWidget(
    tagName: string,
    props: Record<string, string>,
  ): string | null {
    const spec = PLUGIN_CODEGEN_MAP[tagName];
    if (!spec || (spec.render === undefined && spec.widget === undefined)) {
      return null;
    }

    for (const dartImport of spec.imports) {
      this.imports.add(stripImport(dartImport));
    }
    if (spec.controllerField) {
      this.pluginFields.push(`  ${spec.controllerField}`);
    }
    if (spec.initState) {
      this.pluginInitState.push(
        substituteWidgetProps(spec.initState, props, spec.defaults),
      );
    }
    if (spec.dispose) this.pluginDispose.push(spec.dispose);

    if (spec.render !== undefined) {
      return substituteWidgetProps(spec.render, props, spec.defaults);
    }
    // propMap style: assemble `Widget(param: value, …)` for present props.
    const args = Object.entries(spec.propMap ?? {})
      .filter(([tsxProp]) => props[tsxProp] !== undefined)
      .map(([tsxProp, dartParam]) => `${dartParam}: ${props[tsxProp]}`);
    return `${spec.widget}(${args.join(', ')})`;
  }

  /** Wraps `inner` in a GestureDetector when non-native gesture props exist. */
  private wrapGestures(
    inner: string,
    gestureProps: Record<string, string>,
  ): string {
    const keys = Object.keys(gestureProps);
    if (keys.length === 0) return inner;
    const args = keys.map((k) => `${k}: ${gestureProps[k]}`).join(', ');
    return `GestureDetector(${args}, child: ${inner})`;
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

  /**
   * A JS string concatenation (`'Runs: ' + n`, `'a' + x + 'b'`) → a single Dart
   * interpolated string (`'Runs: $n'`, `'a${x}b'`). Dart can't `String + int`,
   * so any `+` chain containing a string literal must become interpolation.
   * Returns null when `expr` isn't such a concatenation.
   */
  private concatToDartString(expr: ts.Expression): string | null {
    if (
      !ts.isBinaryExpression(expr) ||
      expr.operatorToken.kind !== ts.SyntaxKind.PlusToken
    ) {
      return null;
    }
    const operands: ts.Expression[] = [];
    const flatten = (e: ts.Expression): void => {
      if (
        ts.isBinaryExpression(e) &&
        e.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        flatten(e.left);
        flatten(e.right);
      } else {
        operands.push(e);
      }
    };
    flatten(expr);

    const isStr = (e: ts.Expression): boolean =>
      ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
    if (!operands.some(isStr)) return null;

    const escapeLiteral = (s: string): string =>
      s
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\$/g, '\\$')
        .replace(/\n/g, '\\n');

    let body = '';
    operands.forEach((operand, i) => {
      if (isStr(operand)) {
        body += escapeLiteral((operand as ts.StringLiteral).text);
        return;
      }
      const text = operand.getText(this.sourceFile);
      // `$id` only when the next segment can't be read as part of the
      // identifier (e.g. `'a' + n + 'b'` must be `a${n}b`, not `a$nb`).
      const next = operands[i + 1];
      const nextStartsIdent =
        next !== undefined &&
        isStr(next) &&
        /^[A-Za-z0-9_$]/.test((next as ts.StringLiteral).text);
      body +=
        SIMPLE_DART_IDENTIFIER.test(text) && !nextStartsIdent
          ? `$${text}`
          : `\${${text}}`;
    });
    return `'${body}'`;
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
            const concat = this.concatToDartString(expr);
            if (concat) {
              parts.push(concat);
            } else {
              const exprText =
                this.rewriteParamsCall(expr) ?? expr.getText(this.sourceFile);
              parts.push(`'${dartInterpolation(exprText)}'`);
            }
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

    const asyncBody = this.tryBuildAsyncBody(body);
    if (asyncBody) return asyncBody;

    const lines: string[] = [];
    for (const stmt of body.statements) {
      if (ts.isReturnStatement(stmt) && stmt.expression) {
        lines.push(`    return ${this.transformReturnExpr(stmt.expression)};`);
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (!decl.initializer) continue;
          // `const { count, increment } = useCounter()` → store binding.
          const store = this.tryStoreHook(decl);
          if (store) {
            lines.push(...store);
            continue;
          }
          // `const id = useParams('id')` → build()-local Dart final.
          if (ts.isIdentifier(decl.name)) {
            const params = this.rewriteParamsCall(decl.initializer);
            if (params) lines.push(`    final ${decl.name.text} = ${params};`);
          }
        }
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

  /** The future expression for `useAsync(fetcher)` — arrow body, or `fn()`. */
  private asyncFutureExpr(fetcher: ts.Expression | undefined): string {
    if (!fetcher) return 'Future.value()';
    if (ts.isArrowFunction(fetcher)) {
      const fnBody = fetcher.body;
      if (ts.isBlock(fnBody)) {
        const ret = fnBody.statements.find(ts.isReturnStatement);
        return ret?.expression
          ? this.asyncExprText(ret.expression)
          : 'Future.value()';
      }
      return this.asyncExprText(fnBody);
    }
    // Bare reference: `useAsync(loadUser)` → `loadUser()`.
    return `${fetcher.getText(this.sourceFile)}()`;
  }

  /** Future-position expression text, rewriting `fetch(...)` → `_fsxFetch(...)`. */
  private asyncExprText(expr: ts.Expression): string {
    return (
      this.rewriteFetchCall(expr) ??
      this.rewriteFunctionCall(expr) ??
      expr.getText(this.sourceFile)
    );
  }

  /**
   * `fetch(url)` → `_fsxFetch(url)`, registering the helper + http/convert
   * imports. Returns null when `expr` isn't a fetch call.
   */
  private rewriteFetchCall(expr: ts.Expression): string | null {
    if (
      !ts.isCallExpression(expr) ||
      expr.expression.getText(this.sourceFile) !== 'fetch'
    ) {
      return null;
    }
    this.usesFetch = true;
    this.imports.add(HTTP_IMPORT);
    this.imports.add('dart:convert');
    const url = expr.arguments[0]?.getText(this.sourceFile) ?? "''";
    return `_fsxFetch(${url})`;
  }

  /**
   * Feature-functions: `launchUrl(url)`, `share(text)`, `pickFile(opts)`,
   * `clipboard.copy(text)`, `hapticFeedback.light()`, `systemChrome.setOrientation(o)`,
   * `loadAsset(path)`, `appDir()`, `tempDir()`, … → their Dart template (with
   * $0/$1/$0.key args substituted), registering the package import (which the
   * dep collector maps to a pubspec dependency). Returns null for other calls.
   */
  private rewriteFunctionCall(expr: ts.Expression): string | null {
    if (!ts.isCallExpression(expr)) return null;
    const callee = expr.expression.getText(this.sourceFile);
    const fn = FUNCTION_MAP[callee];
    if (!fn) return null;

    if (fn.dartImport) {
      const bare = fn.dartImport
        .replace(/^import\s+'/, '')
        .replace(/';$/, '')
        .replace(/'\s*as\s+\w+/, '');
      this.imports.add(bare);
    }

    const substituted = substitutePluginArgs(fn.dart, expr.arguments, {
      argToDart: (arg) =>
        ts.isTemplateLiteral(arg)
          ? this.transformTemplateLiteral(arg)
          : arg.getText(this.sourceFile),
      sourceFile: this.sourceFile,
    });
    // Omitted optional args (e.g. launchUrl(url) without externalApp) leave a
    // bare $N / $N.key placeholder → default it to null.
    return substituted.replace(/\$\d+(?:\.\w+)*/g, 'null');
  }

  /** Emits build()-local `final` declarations for store/useParams var stmts. */
  private buildLocalDecls(stmt: ts.VariableStatement): string[] {
    const lines: string[] = [];
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.initializer) continue;
      const store = this.tryStoreHook(decl);
      if (store) {
        lines.push(...store);
        continue;
      }
      if (ts.isIdentifier(decl.name)) {
        const params = this.rewriteParamsCall(decl.initializer);
        if (params) lines.push(`    final ${decl.name.text} = ${params};`);
      }
    }
    return lines;
  }

  /**
   * `const { data, loading, error } = useAsync(() => fetch())` rewrites the
   * whole build body to a `FutureBuilder<T>`: the loading guard → not-done
   * connection state, the error guard → `snapshot.hasError`, `data` ←
   * `snapshot.data!`. Preceding hook locals (useParams/store) are emitted first.
   * Returns null when the component doesn't use `useAsync`.
   */
  private tryBuildAsyncBody(body: ts.Block): string | null {
    let asyncDecl: ts.VariableDeclaration | undefined;
    for (const stmt of body.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (
          decl.initializer &&
          ts.isCallExpression(decl.initializer) &&
          decl.initializer.expression.getText(this.sourceFile) === 'useAsync'
        ) {
          asyncDecl = decl;
        }
      }
    }
    if (!asyncDecl || !ts.isObjectBindingPattern(asyncDecl.name)) return null;

    const call = asyncDecl.initializer as ts.CallExpression;
    const futureExpr = this.asyncFutureExpr(call.arguments[0]);
    const typeArg =
      call.typeArguments?.[0]?.getText(this.sourceFile) ?? 'dynamic';

    const names: Record<string, string> = {};
    for (const el of asyncDecl.name.elements) {
      const key = (el.propertyName ?? el.name).getText(this.sourceFile);
      names[key] = el.name.getText(this.sourceFile);
    }
    const { data: dataName, loading: loadingName, error: errorName } = names;

    const preLines: string[] = [];
    let loadingTree: string | null = null;
    let errorTree: string | null = null;
    let dataTree: string | null = null;

    let seenAsync = false;
    for (const stmt of body.statements) {
      if (ts.isVariableStatement(stmt)) {
        if (stmt.declarationList.declarations.some((d) => d === asyncDecl)) {
          seenAsync = true;
          continue;
        }
        if (!seenAsync) preLines.push(...this.buildLocalDecls(stmt));
        continue;
      }
      if (ts.isIfStatement(stmt)) {
        const guard = stmt.expression.getText(this.sourceFile);
        const ret = this.extractGuardReturn(stmt.thenStatement);
        if (ret === null) continue;
        if (loadingName && guard === loadingName) loadingTree = ret;
        else if (errorName && guard === errorName) errorTree = ret;
        continue;
      }
      if (ts.isReturnStatement(stmt) && stmt.expression) {
        dataTree = this.transformReturnExpr(stmt.expression);
      }
    }

    const loadingBody =
      loadingTree ?? 'const Center(child: CircularProgressIndicator())';
    const lines: string[] = [...preLines];
    lines.push(`    return FutureBuilder<${typeArg}>(`);
    lines.push(`      future: ${futureExpr},`);
    lines.push(`      builder: (context, snapshot) {`);
    lines.push(
      `        if (snapshot.connectionState != ConnectionState.done) {`,
    );
    lines.push(`          return ${loadingBody};`);
    lines.push(`        }`);
    const usesLocal = (
      name: string | undefined,
      tree: string | null,
    ): boolean =>
      Boolean(name && tree && new RegExp(`\\b${name}\\b`).test(tree));
    lines.push(`        if (snapshot.hasError) {`);
    // Only bind the error/data locals when the branch actually reads them
    // (else Dart flags an unused local).
    if (usesLocal(errorName, errorTree)) {
      lines.push(`          final ${errorName} = snapshot.error;`);
    }
    lines.push(`          return ${errorTree ?? "Text('${snapshot.error}')"};`);
    lines.push(`        }`);
    if (usesLocal(dataName, dataTree)) {
      lines.push(`        final ${dataName} = snapshot.data!;`);
    }
    lines.push(`        return ${dataTree ?? 'const SizedBox.shrink()'};`);
    lines.push(`      },`);
    lines.push(`    );`);
    return lines.join('\n');
  }

  /**
   * Rewrites `const { count, increment } = useCounter()` (or `const c =
   * useCounter()`) to a `context.watch<CounterStore>()` binding plus a local
   * `final` per destructured name (state reads + action tear-offs alike), so
   * existing JSX references resolve unchanged. Returns null if not a store hook.
   */
  private tryStoreHook(decl: ts.VariableDeclaration): string[] | null {
    const init = decl.initializer;
    if (!init || !ts.isCallExpression(init)) return null;
    const hookName = init.expression.getText(this.sourceFile);
    if (!this.storeHooks.has(hookName)) return null;

    this.storesUsed = true;
    this.imports.add('package:provider/provider.dart');
    // Cross-file store: import the Dart file holding the ChangeNotifier class.
    const storeFile = this.localComponents.get(hookName);
    if (storeFile) this.imports.add(storeFile);
    const className = storeClassName(hookName);

    if (ts.isIdentifier(decl.name)) {
      return [`    final ${decl.name.text} = context.watch<${className}>();`];
    }

    if (ts.isObjectBindingPattern(decl.name)) {
      const local = storeLocalName(hookName);
      const lines = [`    final ${local} = context.watch<${className}>();`];
      for (const el of decl.name.elements) {
        const prop = (el.propertyName ?? el.name).getText(this.sourceFile);
        const alias = el.name.getText(this.sourceFile);
        lines.push(`    final ${alias} = ${local}.${prop};`);
      }
      return lines;
    }

    return null;
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
        result[dartParam] = this.transformExprProp(tsxName, expr, propDef);
      }
    }

    return result;
  }

  private transformStringProp(
    tagName: string,
    propName: string,
    value: string,
  ): string {
    // Dispatch on the SDK-derived `transform` classification — single source of
    // truth, no per-prop hardcoding.
    const widgetDef = WIDGET_MAP.get(tagName);
    const propDef =
      widgetDef?.props.find((p) => p.tsxProp === propName) ??
      widgetDef?.styling.find((p) => p.tsxProp === propName);

    switch (propDef?.transform) {
      case 'color':
        return transformColor(value);
      case 'edgeinsets':
        return transformPadding(Number(value) || value);
      case 'enum':
        return `${propDef.dartType.replace('?', '')}.${value}`;
      // A string on a Widget-typed prop (AppBar.title, ListTile.title) → Text.
      case 'widget':
        return `Text(${dartString(value)})`;
    }

    // Convenience props with no SDK backing (flutter-tsx sugar, not Flutter API):
    // TextField `label` → InputDecoration(labelText:).
    if (propName === 'label') {
      return `InputDecoration(labelText: ${dartString(value)})`;
    }

    // The extractor leaves many Color/EdgeInsets props as `dynamic`/`none`
    // (unresolved generics); recover those by name until the extractor
    // classifies them. Tracked as the derive-stage gap, not new static logic.
    if (propDef?.transform === undefined || propDef.transform === 'none') {
      if (propName.toLowerCase().includes('color')) return transformColor(value);
      if (propName === 'padding' || propName === 'margin') {
        return transformPadding(Number(value) || value);
      }
    }

    return dartString(value);
  }

  private transformExprProp(
    propName: string,
    expr: ts.Expression,
    propDef?: { transform: string; dartType: string },
  ): string {
    const raw = expr.getText(this.sourceFile);
    const transform = propDef?.transform;
    // The extractor leaves some Color/EdgeInsets props as `dynamic`/`none`;
    // fall back to the prop name for those until it classifies them.
    const underClassified = transform === undefined || transform === 'none';
    const isColor =
      transform === 'color' ||
      (underClassified && propName.toLowerCase().includes('color'));
    const isEdgeInsets =
      transform === 'edgeinsets' ||
      (underClassified && (propName === 'padding' || propName === 'margin'));

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
      transform === 'widget' &&
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

    if (isColor) {
      if (ts.isStringLiteral(expr)) return transformColor(expr.text);
      // A color name inside a ternary (e.g. `color={on ? 'blue' : 'grey'}`,
      // the common animated-color case) — convert each string-literal branch.
      if (ts.isConditionalExpression(expr)) {
        const branch = (e: ts.Expression): string =>
          ts.isStringLiteral(e)
            ? transformColor(e.text)
            : e.getText(this.sourceFile);
        return `${expr.condition.getText(this.sourceFile)} ? ${branch(expr.whenTrue)} : ${branch(expr.whenFalse)}`;
      }
      return raw;
    }

    if (isEdgeInsets) {
      if (ts.isArrayLiteralExpression(expr)) {
        const arr = expr.elements.map((e) =>
          parseFloat(e.getText(this.sourceFile)),
        );
        return transformPadding(arr);
      }
      // A bare number → EdgeInsets.all(n) (must precede the generic numeric
      // pass-through below, which would otherwise emit an invalid `padding: 16`).
      if (raw.trim() !== '' && !isNaN(Number(raw))) {
        return transformPadding(Number(raw));
      }
      return raw;
    }

    if (propName.startsWith('on')) {
      // `onChange`/`onChanged` is a ValueChanged<T> — its closure must accept the
      // new value even when the TSX arrow ignores it (Switch, Checkbox, Slider…).
      const expectsValue = propName === 'onChange' || propName === 'onChanged';
      return this.transformCallbackExpr(expr, expectsValue);
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

  private transformCallbackExpr(
    expr: ts.Expression,
    expectsValue = false,
  ): string {
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
          return `(value) ${asyncKeyword(transformed)}{ ${transformed} }`;
        }
      }

      // General callback with parameters: (index) => setIdx(index) → (index) { ... }
      const transformed = this.transformCallbackBody(body);
      const async = asyncKeyword(transformed);
      // A ValueChanged<T> callback (onChanged) must accept the value even when
      // the TSX arrow ignores it — `() => …` becomes `(value) { … }`.
      const paramList =
        parameters.length === 0 && expectsValue
          ? 'value'
          : parameters.map((p) => p.name.getText(src)).join(', ');
      return paramList
        ? `(${paramList}) ${async}{ ${transformed} }`
        : `() ${async}{ ${transformed} }`;
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
          // Substitute $0, $1, ... and $0.key (object property access);
          // template-literal args become Dart string interpolation.
          const substituted = substitutePluginArgs(template, node.arguments, {
            argToDart: (arg) =>
              ts.isTemplateLiteral(arg)
                ? this.transformTemplateLiteral(arg)
                : arg.getText(src),
            sourceFile: src,
          });
          return `${substituted};`;
        }
        // Unknown method on known plugin var — fall through to raw text
      }
    }

    // showSheet/showDialog(<X/>) → showModalBottomSheet/showDialog(...)
    if (ts.isCallExpression(node)) {
      const modal = this.rewriteModalCall(node);
      if (modal) return `${modal};`;
    }

    // Feature-functions: launchUrl(...), share(...), clipboard.copy(...), …
    if (ts.isCallExpression(node)) {
      const fn = this.rewriteFunctionCall(node);
      if (fn !== null) return `${fn};`;
    }

    // const/final x = await pickFile(…) | clipboard.paste() | loadAsset(…) | …
    if (ts.isVariableStatement(node)) {
      const lines: string[] = [];
      let allRewritten = true;
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        const inner =
          init && ts.isAwaitExpression(init) ? init.expression : init;
        const rewritten = inner
          ? (this.rewriteFunctionCall(inner) ?? this.rewriteFetchCall(inner))
          : null;
        if (ts.isIdentifier(decl.name) && rewritten != null) {
          lines.push(`final ${decl.name.text} = ${rewritten};`);
        } else {
          allRewritten = false;
          break;
        }
      }
      if (allRewritten && lines.length > 0) return lines.join(' ');
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
      parts.push(dartInterpolation(exprText));
      parts.push(span.literal.text);
    }

    return `'${parts.join('')}'`;
  }

  /**
   * `useParams('key')` → `GoRouterState.of(context).pathParameters['key']!`
   * (file-based routing param access), or null if `expr` isn't a useParams call.
   */
  private rewriteParamsCall(expr: ts.Expression): string | null {
    if (
      ts.isCallExpression(expr) &&
      expr.expression.getText(this.sourceFile) === 'useParams' &&
      expr.arguments.length === 1 &&
      ts.isStringLiteral(expr.arguments[0])
    ) {
      this.imports.add('package:go_router/go_router.dart');
      return `GoRouterState.of(context).pathParameters['${expr.arguments[0].text}']!`;
    }
    return null;
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
      // String concatenation child → Text('…') with interpolation.
      const concat = this.concatToDartString(expr);
      if (concat) return `Text(${concat})`;
      const result = tryTransformAndExpression(expr, src, (n) =>
        this.visitJSX(n, null),
      );
      if (result) return result;
    }

    if (ts.isCallExpression(expr)) {
      const params = this.rewriteParamsCall(expr);
      if (params) return params;
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

// ---------------------------------------------------------------------------
// createStore → ChangeNotifier (Zustand-style state management)
// ---------------------------------------------------------------------------

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `useCounter` → `CounterStore`. */
export const storeClassName = (hookName: string): string =>
  `${cap(hookName.startsWith('use') ? hookName.slice(3) : hookName)}Store`;

/** `useCounter` → `counterStore` (the build()-local watched instance). */
const storeLocalName = (hookName: string): string => {
  const base = hookName.startsWith('use') ? hookName.slice(3) : hookName;
  return `${base.charAt(0).toLowerCase() + base.slice(1)}Store`;
};

/** Infers a Dart field type from a state literal (int/double/String/bool/var). */
const dartFieldType = (init: ts.Expression): string => {
  if (ts.isNumericLiteral(init))
    return init.text.includes('.') ? 'double' : 'int';
  if (ts.isStringLiteral(init)) return 'String';
  if (
    init.kind === ts.SyntaxKind.TrueKeyword ||
    init.kind === ts.SyntaxKind.FalseKeyword
  )
    return 'bool';
  return 'var';
};

/** `set((s) => ({ f: s.f + 1 }))` → ['f = f + 1;', …] (state param stripped). */
const translateSetMutations = (
  setCall: ts.CallExpression,
  src: ts.SourceFile,
): string[] => {
  const arrow = setCall.arguments[0];
  if (!arrow || !ts.isArrowFunction(arrow)) return [];
  const param = arrow.parameters[0]?.name.getText(src);
  let body: ts.Node = arrow.body;
  if (ts.isParenthesizedExpression(body)) body = body.expression;
  if (!ts.isObjectLiteralExpression(body)) return [];
  const lines: string[] = [];
  for (const prop of body.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const field = prop.name.getText(src);
    let expr = prop.initializer.getText(src);
    if (param) expr = expr.replace(new RegExp(`\\b${param}\\.`, 'g'), '');
    lines.push(`    ${field} = ${expr};`);
  }
  return lines;
};

/** Builds one `ChangeNotifier` method from a store action arrow. */
const buildStoreAction = (
  name: string,
  fn: ts.ArrowFunction | ts.FunctionExpression,
  src: ts.SourceFile,
): string => {
  const params = fn.parameters
    .map((p) => `dynamic ${p.name.getText(src)}`)
    .join(', ');
  let body: ts.Node = fn.body;
  if (ts.isBlock(body)) {
    const ret = body.statements.find(ts.isExpressionStatement);
    body = ret ? ret.expression : body;
  }
  const mutations =
    ts.isCallExpression(body) && body.expression.getText(src) === 'set'
      ? translateSetMutations(body, src)
      : [];
  return [
    `  void ${name}(${params}) {`,
    ...mutations,
    '    notifyListeners();',
    '  }',
  ].join('\n');
};

/** Generates a `ChangeNotifier` class from a `createStore` factory. */
const buildStoreClass = (
  hookName: string,
  factory: ts.ArrowFunction | ts.FunctionExpression,
  src: ts.SourceFile,
): string | null => {
  let body: ts.Node = factory.body;
  if (ts.isParenthesizedExpression(body)) body = body.expression;
  if (ts.isBlock(body)) {
    const ret = body.statements.find(ts.isReturnStatement);
    if (ret?.expression) body = ret.expression;
  }
  if (!ts.isObjectLiteralExpression(body)) return null;

  const fields: string[] = [];
  const methods: string[] = [];
  for (const prop of body.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name.getText(src);
    const init = prop.initializer;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
      methods.push(buildStoreAction(name, init, src));
    } else {
      fields.push(`  ${dartFieldType(init)} ${name} = ${init.getText(src)};`);
    }
  }
  return [
    `class ${storeClassName(hookName)} extends ChangeNotifier {`,
    ...fields,
    ...methods,
    `}`,
  ].join('\n');
};

/** Scans a file for `export const useX = createStore(...)` → ChangeNotifier classes. */
const buildStoreClasses = (sourceFile: ts.SourceFile): string[] => {
  const classes: string[] = [];
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.initializer || !ts.isCallExpression(decl.initializer)) continue;
      if (decl.initializer.expression.getText(sourceFile) !== 'createStore')
        continue;
      const factory = decl.initializer.arguments[0];
      if (
        ts.isIdentifier(decl.name) &&
        factory &&
        (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))
      ) {
        const cls = buildStoreClass(decl.name.text, factory, sourceFile);
        if (cls) classes.push(cls);
      }
    }
  }
  return classes;
};

/** Names of the `useX` hooks defined via `createStore` in a file. */
const extractStoreHookNames = (sourceFile: ts.SourceFile): string[] => {
  const names: string[] = [];
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.initializer &&
        ts.isCallExpression(decl.initializer) &&
        decl.initializer.expression.getText(sourceFile) === 'createStore'
      ) {
        names.push(decl.name.text);
      }
    }
  }
  return names;
};

const buildDartOutput = (
  sourceFile: ts.SourceFile,
  components: ExportedComponent[],
  options?: CodegenOptions,
): { code: string; ctx: CodegenContext } => {
  const storeHooks = new Set([
    ...(options?.storeHooks ?? []),
    ...extractStoreHookNames(sourceFile),
  ]);
  const ctx = new CodegenContext(sourceFile, { ...options, storeHooks });

  const componentNames = new Set(components.map((c) => c.name));
  const dataConsts = collectDataConsts(sourceFile, componentNames);
  const storeClasses = buildStoreClasses(sourceFile);

  const componentBodies = components
    .map((c) => ctx.generateComponent(c))
    .filter(Boolean);

  const importLines = [...ctx.imports].map((i) => `import '${i}';`).join('\n');
  const routerDecl = ctx.routerDecl();

  const parts: string[] = [
    `// GENERATED — do not edit. Source: ${sourceFile.fileName}`,
    GENERATED_IGNORES,
    importLines,
    ``,
    ...(routerDecl ? [routerDecl, ''] : []),
    ...(ctx.usesFetch ? [FETCH_HELPER, ''] : []),
    ...(dataConsts.length > 0 ? [dataConsts.join('\n'), ''] : []),
    ...storeClasses.flatMap((cls) => [cls, '']),
    ...ctx.tabWidgets.flatMap((cls) => [cls, '']),
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
