import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import ts from "typescript";

const roots = ["apps", "packages"];
const ignoredDirectoryNames = new Set([
  ".bun",
  ".git",
  ".next",
  ".vite",
  "build",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const allowedExtensions = new Set([".ts", ".tsx"]);

function collectSourceFiles(root) {
  const files = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = readdirSync(currentPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = join(currentPath, entry);
      let stats;
      try {
        stats = statSync(absolutePath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        if (ignoredDirectoryNames.has(entry)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (stats.isFile() && allowedExtensions.has(extname(entry))) {
        files.push(absolutePath);
      }
    }
  }

  walk(root);
  return files;
}

function collectReactHookNames(sourceFile) {
  const hookNames = {
    effect: new Set(["useEffect"]),
    layoutEffect: new Set(["useLayoutEffect"]),
    state: new Set(["useState"]),
    namespaceImports: new Set(),
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }

    const moduleName = statement.moduleSpecifier.getText(sourceFile).slice(1, -1);
    if (moduleName !== "react") {
      continue;
    }

    if (
      statement.importClause.namedBindings &&
      ts.isNamespaceImport(statement.importClause.namedBindings)
    ) {
      hookNames.namespaceImports.add(statement.importClause.namedBindings.name.text);
    }

    if (
      statement.importClause.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const specifier of statement.importClause.namedBindings.elements) {
        const importedName = specifier.propertyName?.text ?? specifier.name.text;
        const localName = specifier.name.text;

        if (importedName === "useState") {
          hookNames.state.add(localName);
        }
        if (importedName === "useEffect") {
          hookNames.effect.add(localName);
        }
        if (importedName === "useLayoutEffect") {
          hookNames.layoutEffect.add(localName);
        }
      }
    }
  }

  return hookNames;
}

function isReactHookCall(expression, hookLocalNames, namespaceImports, hookName) {
  if (ts.isIdentifier(expression)) {
    return hookLocalNames.has(expression.text);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    if (!ts.isIdentifier(expression.expression)) {
      return false;
    }
    return (
      namespaceImports.has(expression.expression.text) && expression.name.text === hookName
    );
  }
  return false;
}

function collectStateSetterNames(sourceFile, hookNames) {
  const setterNames = new Set();

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer) {
      if (
        ts.isCallExpression(node.initializer) &&
        isReactHookCall(
          node.initializer.expression,
          hookNames.state,
          hookNames.namespaceImports,
          "useState",
        )
      ) {
        const secondElement = node.name.elements[1];
        if (secondElement && ts.isBindingElement(secondElement) && ts.isIdentifier(secondElement.name)) {
          setterNames.add(secondElement.name.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return setterNames;
}

function getLineAndColumn(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${line + 1}:${character + 1}`;
}

function findViolationsInEffectCallback(callbackNode, setterNames, sourceFile, filePath, effectName) {
  const violations = [];

  function visit(node) {
    if (node !== callbackNode && ts.isFunctionLike(node)) {
      return;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const calledFunctionName = node.expression.text;
      if (setterNames.has(calledFunctionName)) {
        violations.push(
          `${filePath}:${getLineAndColumn(sourceFile, node)} - ${effectName} should not call React state setter \`${calledFunctionName}\` directly.`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(callbackNode);
  return violations;
}

function lintFile(filePath) {
  const sourceText = readFileSync(filePath, "utf8");
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

  const hookNames = collectReactHookNames(sourceFile);
  const setterNames = collectStateSetterNames(sourceFile, hookNames);
  if (setterNames.size === 0) {
    return [];
  }

  const violations = [];

  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const isUseEffectCall = isReactHookCall(
        node.expression,
        hookNames.effect,
        hookNames.namespaceImports,
        "useEffect",
      );
      const isUseLayoutEffectCall = isReactHookCall(
        node.expression,
        hookNames.layoutEffect,
        hookNames.namespaceImports,
        "useLayoutEffect",
      );

      if (isUseEffectCall || isUseLayoutEffectCall) {
        const callbackNode = node.arguments[0];
        if (ts.isArrowFunction(callbackNode) || ts.isFunctionExpression(callbackNode)) {
          const effectName = isUseLayoutEffectCall ? "useLayoutEffect" : "useEffect";
          violations.push(
            ...findViolationsInEffectCallback(
              callbackNode.body,
              setterNames,
              sourceFile,
              filePath,
              effectName,
            ),
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

const files = roots.flatMap((root) => collectSourceFiles(root));
const violations = files.flatMap((filePath) => lintFile(filePath));

if (violations.length > 0) {
  console.error("react/no-state-updates-in-effect violations:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(`react/no-state-updates-in-effect passed on ${files.length} files.`);
