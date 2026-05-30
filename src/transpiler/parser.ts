import ts from 'typescript';

export interface ParsedFile {
  sourceFile: ts.SourceFile;
  program: ts.Program;
  exports: ExportedComponent[];
  /**
   * Identifiers imported from relative modules, mapped to the Dart file that
   * the transpiler emits for them (e.g. `HomeScreen` → `HomeScreen.dart`).
   * Used by codegen to emit cross-file Dart `import` statements when a local
   * component is referenced in JSX. Bare-package imports are excluded.
   */
  localComponents: Map<string, string>;
}

export interface ExportedComponent {
  name: string;
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
  isArrow: boolean;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  jsxImportSource: 'flutter.tsx',
  strict: false,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  esModuleInterop: true,
  skipLibCheck: true,
};

const hasExportModifier = (node: ts.Node): boolean => {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

const findJSXNode = (
  node: ts.Node,
): ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | null => {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return node;
  }
  if (ts.isParenthesizedExpression(node)) {
    return findJSXNode(node.expression);
  }
  return null;
};

const extractExports = (sourceFile: ts.SourceFile): ExportedComponent[] => {
  const exports: ExportedComponent[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      hasExportModifier(statement) &&
      statement.name
    ) {
      exports.push({
        name: statement.name.getText(sourceFile),
        node: statement,
        isArrow: false,
      });
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.getText(sourceFile);

        if (decl.initializer) {
          if (ts.isArrowFunction(decl.initializer)) {
            exports.push({ name, node: decl.initializer, isArrow: true });
          } else if (ts.isFunctionExpression(decl.initializer)) {
            exports.push({ name, node: decl.initializer, isArrow: false });
          }
        }
      }
    }
  }

  return exports;
};

// Maps a relative module specifier to the Dart file the transpiler emits for
// it. Output is flat + keeps the source basename (e.g. App.tsx → App.dart), so
// `./screens/HomeScreen.js` resolves to `HomeScreen.dart`.
const specifierToDartFile = (specifier: string): string => {
  const base = specifier.replace(/^.*\//, '').replace(/\.(tsx?|jsx?)$/, '');
  return `${base}.dart`;
};

const extractLocalComponents = (
  sourceFile: ts.SourceFile,
): Map<string, string> => {
  const localComponents = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue; // relative imports only

    const dartFile = specifierToDartFile(specifier);
    const { importClause } = statement;
    if (!importClause) continue;

    if (importClause.name) {
      localComponents.set(importClause.name.getText(sourceFile), dartFile);
    }

    const { namedBindings } = importClause;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        localComponents.set(element.name.getText(sourceFile), dartFile);
      }
    }
  }

  return localComponents;
};

export const parseFile = (filePath: string): ParsedFile => {
  const program = ts.createProgram([filePath], COMPILER_OPTIONS);
  const sourceFile = program.getSourceFile(filePath);

  if (!sourceFile) {
    throw new Error(`Could not parse file: ${filePath}`);
  }

  return {
    sourceFile,
    program,
    exports: extractExports(sourceFile),
    localComponents: extractLocalComponents(sourceFile),
  };
};

export const parseSource = (
  sourceText: string,
  fileName = 'virtual.tsx',
): ParsedFile => {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const origGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    name: string,
    langVer: ts.ScriptTarget,
  ): ts.SourceFile | undefined => {
    if (name === fileName) return sourceFile;
    return origGetSourceFile(name, langVer);
  };

  const program = ts.createProgram([fileName], COMPILER_OPTIONS, host);

  return {
    sourceFile,
    program,
    exports: extractExports(sourceFile),
    localComponents: extractLocalComponents(sourceFile),
  };
};

export const getFunctionBody = (
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): ts.Block | ts.Expression | null => {
  if (ts.isArrowFunction(node)) return node.body;
  return node.body ?? null; // FunctionDeclaration | FunctionExpression
};

export const getReturnJSX = (
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | null => {
  const body = getFunctionBody(node);
  if (!body) return null;

  if (!ts.isBlock(body)) {
    return findJSXNode(body);
  }

  for (const stmt of body.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      return findJSXNode(stmt.expression);
    }
  }

  return null;
};
