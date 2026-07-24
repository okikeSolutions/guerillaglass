import { readdirSync, readFileSync, statSync } from "node:fs";
import { delimiter, extname, join } from "node:path";
import { parseSync } from "oxc-parser";

const roots = process.env.GG_REACT_EFFECT_LINT_ROOTS
  ? process.env.GG_REACT_EFFECT_LINT_ROOTS.split(delimiter).filter(Boolean)
  : ["apps", "packages"];
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
        if (!ignoredDirectoryNames.has(entry)) {
          walk(absolutePath);
        }
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

function walkAst(root, visit, shouldDescend = () => true) {
  const seen = new WeakSet();

  function walk(value) {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (seen.has(value) || typeof value.type !== "string") {
      return;
    }

    seen.add(value);
    visit(value);
    if (!shouldDescend(value)) {
      return;
    }
    for (const child of Object.values(value)) {
      walk(child);
    }
  }

  walk(root);
}

function collectReactHookNames(program) {
  const hookNames = {
    effect: new Set(["useEffect"]),
    layoutEffect: new Set(["useLayoutEffect"]),
    state: new Set(["useState"]),
    namespaceImports: new Set(),
  };

  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "react") {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportNamespaceSpecifier") {
        hookNames.namespaceImports.add(specifier.local.name);
        continue;
      }
      if (specifier.type !== "ImportSpecifier") {
        continue;
      }

      const importedName = specifier.imported.name ?? specifier.imported.value;
      const localName = specifier.local.name;
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

  return hookNames;
}

function unwrapParenthesizedExpression(expression) {
  let current = expression;
  while (current?.type === "ParenthesizedExpression") {
    current = current.expression;
  }
  return current;
}

function isReactHookCall(callee, hookLocalNames, namespaceImports, hookName) {
  if (callee.type === "Identifier") {
    return hookLocalNames.has(callee.name);
  }
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.property.type === "Identifier" &&
    namespaceImports.has(callee.object.name) &&
    callee.property.name === hookName
  );
}

function collectStateSetterNames(program, hookNames) {
  const setterNames = new Set();

  walkAst(program, (node) => {
    if (
      node.type !== "VariableDeclarator" ||
      node.id.type !== "ArrayPattern" ||
      node.init?.type !== "CallExpression" ||
      !isReactHookCall(node.init.callee, hookNames.state, hookNames.namespaceImports, "useState")
    ) {
      return;
    }

    const setter = node.id.elements[1];
    if (setter?.type === "Identifier") {
      setterNames.add(setter.name);
    }
  });

  return setterNames;
}

function isFunctionLike(node) {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "TSDeclareFunction"
  );
}

function getLineAndColumn(sourceText, offset) {
  const before = sourceText.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return `${lines.length}:${lines.at(-1).length + 1}`;
}

function findViolationsInEffectCallback(
  callbackBody,
  setterNames,
  sourceText,
  filePath,
  effectName,
) {
  const violations = [];

  walkAst(
    callbackBody,
    (node) => {
      if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        setterNames.has(node.callee.name)
      ) {
        violations.push(
          `${filePath}:${getLineAndColumn(sourceText, node.start)} - ${effectName} should not call React state setter \`${node.callee.name}\` directly.`,
        );
      }
    },
    (node) => node === callbackBody || !isFunctionLike(node),
  );

  return violations;
}

function lintFile(filePath) {
  const sourceText = readFileSync(filePath, "utf8");
  const { program, errors } = parseSync(filePath, sourceText);
  if (errors.length > 0) {
    throw new Error(`Unable to parse ${filePath}: ${errors[0].message}`);
  }

  const hookNames = collectReactHookNames(program);
  const setterNames = collectStateSetterNames(program, hookNames);
  if (setterNames.size === 0) {
    return [];
  }

  const violations = [];
  walkAst(program, (node) => {
    if (node.type !== "CallExpression" || node.arguments.length === 0) {
      return;
    }

    const isUseEffectCall = isReactHookCall(
      node.callee,
      hookNames.effect,
      hookNames.namespaceImports,
      "useEffect",
    );
    const isUseLayoutEffectCall = isReactHookCall(
      node.callee,
      hookNames.layoutEffect,
      hookNames.namespaceImports,
      "useLayoutEffect",
    );
    if (!isUseEffectCall && !isUseLayoutEffectCall) {
      return;
    }

    const callback = unwrapParenthesizedExpression(node.arguments[0]);
    if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") {
      return;
    }

    violations.push(
      ...findViolationsInEffectCallback(
        callback.body,
        setterNames,
        sourceText,
        filePath,
        isUseLayoutEffectCall ? "useLayoutEffect" : "useEffect",
      ),
    );
  });

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
