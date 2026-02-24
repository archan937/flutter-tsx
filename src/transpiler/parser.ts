import ts from "typescript";

export interface ParsedFile {
  sourceFile: ts.SourceFile;
  program: ts.Program;
  exports: ExportedComponent[];
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
  jsxImportSource: "flutter.tsx",
  strict: false,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  esModuleInterop: true,
  skipLibCheck: true,
};

/**
 * Parses a TSX file and returns its AST + list of exported components.
 */
export function parseFile(filePath: string): ParsedFile {
  const program = ts.createProgram([filePath], COMPILER_OPTIONS);
  const sourceFile = program.getSourceFile(filePath);

  if (!sourceFile) {
    throw new Error(`Could not parse file: ${filePath}`);
  }

  const exports = extractExports(sourceFile);

  return { sourceFile, program, exports };
}

/**
 * Parses TSX source text (for testing without a file on disk).
 */
export function parseSource(
  sourceText: string,
  fileName = "virtual.tsx"
): ParsedFile {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );

  // Create a minimal program with in-memory source
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const origGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, langVer) => {
    if (name === fileName) return sourceFile;
    return origGetSourceFile(name, langVer);
  };

  const program = ts.createProgram([fileName], COMPILER_OPTIONS, host);
  const exports = extractExports(sourceFile);

  return { sourceFile, program, exports };
}

/**
 * Walks top-level statements looking for exported function/const components.
 */
function extractExports(sourceFile: ts.SourceFile): ExportedComponent[] {
  const exports: ExportedComponent[] = [];

  for (const statement of sourceFile.statements) {
    // export function Foo() { ... }
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

    // export const Foo = () => ...  |  export const Foo = function() { ... }
    if (
      ts.isVariableStatement(statement) &&
      hasExportModifier(statement)
    ) {
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
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Returns the function body (ts.Block) from a component node.
 */
export function getFunctionBody(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile
): ts.Block | ts.Expression | null {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.body ?? null;
  }
  // Arrow function: body may be block or concise body
  if (ts.isArrowFunction(node)) {
    return node.body;
  }
  return null;
}

/**
 * Finds the return statement (or concise expression) in a component function.
 */
export function getReturnJSX(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile
): ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | null {
  const body = getFunctionBody(node, sourceFile);
  if (!body) return null;

  // Concise arrow: () => <Widget />
  if (!ts.isBlock(body)) {
    return findJSXNode(body);
  }

  // Block: find the return statement
  for (const stmt of body.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      return findJSXNode(stmt.expression);
    }
  }

  return null;
}

function findJSXNode(
  node: ts.Node
): ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | null {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return node;
  }
  // Wrapped in parens: return (<Widget />)
  if (ts.isParenthesizedExpression(node)) {
    return findJSXNode(node.expression);
  }
  return null;
}
