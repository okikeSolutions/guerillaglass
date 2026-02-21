#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const POLICY_PATH = "docs/doc_coverage_policy.json";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const requestedScope = scopeArg ? scopeArg.slice("--scope=".length) : "all";

const scopeMap = {
  all: ["typescript", "swift", "rust"],
  ts: ["typescript"],
  typescript: ["typescript"],
  swift: ["swift"],
  rust: ["rust"],
  native: ["swift", "rust"],
};

const selectedLanguages = scopeMap[requestedScope];
if (!selectedLanguages) {
  console.error(`Unknown docs gate scope: ${requestedScope}`);
  process.exit(1);
}

const rawPolicy = fs.readFileSync(POLICY_PATH, "utf8");
const policy = JSON.parse(rawPolicy);

const languageAnalyzers = {
  typescript: analyzeTypeScriptFile,
  swift: analyzeSwiftFile,
  rust: analyzeRustFile,
};

const failures = [];
const summaries = [];

for (const language of selectedLanguages) {
  const groups = policy[language] ?? [];
  for (const group of groups) {
    const analyzer = languageAnalyzers[language];
    const files = collectFiles(group.roots, group.extensions);

    const declarations = [];
    for (const filePath of files) {
      const fileText = fs.readFileSync(filePath, "utf8");
      const fileDeclarations = analyzer(filePath, fileText);
      declarations.push(...fileDeclarations);
    }

    const documentedCount = declarations.filter((item) => item.documented).length;
    const totalCount = declarations.length;
    const coverage = totalCount === 0 ? 1 : documentedCount / totalCount;

    summaries.push({
      language,
      name: group.name,
      minimumCoverage: group.minimumCoverage,
      documentedCount,
      totalCount,
      coverage,
    });

    if (coverage + Number.EPSILON < group.minimumCoverage) {
      failures.push({
        language,
        name: group.name,
        minimumCoverage: group.minimumCoverage,
        documentedCount,
        totalCount,
        coverage,
        missing: declarations.filter((item) => !item.documented).slice(0, 20),
      });
    }
  }
}

console.log("Documentation coverage gate:");
for (const summary of summaries) {
  const coveragePercent = (summary.coverage * 100).toFixed(1);
  const minimumPercent = (summary.minimumCoverage * 100).toFixed(1);
  console.log(
    `- [${summary.language}] ${summary.name}: ${summary.documentedCount}/${summary.totalCount} (${coveragePercent}%) min ${minimumPercent}%`,
  );
}

if (failures.length > 0) {
  console.error("\nDocumentation coverage check failed:");
  for (const failure of failures) {
    const coveragePercent = (failure.coverage * 100).toFixed(1);
    const minimumPercent = (failure.minimumCoverage * 100).toFixed(1);
    console.error(
      `- [${failure.language}] ${failure.name}: ${coveragePercent}% < ${minimumPercent}% (${failure.documentedCount}/${failure.totalCount})`,
    );
    for (const missing of failure.missing) {
      console.error(`  - ${missing.filePath}:${missing.line} ${missing.name}`);
    }
  }
  process.exit(1);
}

console.log("Documentation coverage check passed.");

function collectFiles(roots, extensions) {
  const result = [];
  const extensionSet = new Set(extensions);

  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    if (!fs.existsSync(resolvedRoot)) {
      continue;
    }
    walkDirectory(resolvedRoot, extensionSet, result);
  }

  result.sort();
  return result;
}

function walkDirectory(directoryPath, extensionSet, result) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, extensionSet, result);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (extensionSet.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }
}

function analyzeTypeScriptFile(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const declarations = [];

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement) || ts.isExportDeclaration(statement)) {
      continue;
    }

    const documented = hasDocCommentAboveTypeScriptNode(sourceText, statement);
    const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;

    if (ts.isVariableStatement(statement)) {
      const names = statement.declarationList.declarations
        .map((declaration) => declaration.name.getText(sourceFile))
        .join(", ");
      declarations.push({ filePath, line, name: `export ${names}`, documented });
      continue;
    }

    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const name = statement.name?.text ?? "default";
      declarations.push({ filePath, line, name: `export ${name}`, documented });
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      declarations.push({ filePath, line, name: `export ${statement.name.text}`, documented });
      continue;
    }
  }

  return declarations;
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function hasDocCommentAboveTypeScriptNode(sourceText, node) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
  if (ranges.length === 0) {
    return false;
  }

  const lastRange = ranges[ranges.length - 1];
  const between = sourceText.slice(lastRange.end, node.getStart());
  if (between.trim().length > 0) {
    return false;
  }

  const comment = sourceText.slice(lastRange.pos, lastRange.end).trimStart();
  return comment.startsWith("/**");
}

function analyzeSwiftFile(filePath, sourceText) {
  const declarations = [];
  const lines = sourceText.split(/\r?\n/);
  const declarationPattern =
    /^(public|open)\s+(?:final\s+)?(?:class|struct|enum|protocol|actor|typealias|func|var|let|extension|init)\b/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith(" ") || line.startsWith("\t")) {
      continue;
    }
    if (!declarationPattern.test(line)) {
      continue;
    }

    declarations.push({
      filePath,
      line: index + 1,
      name: line.trim(),
      documented: hasDocCommentAboveLine(lines, index, ["///"]),
    });
  }

  return declarations;
}

function analyzeRustFile(filePath, sourceText) {
  const declarations = [];
  const lines = sourceText.split(/\r?\n/);
  const declarationPattern = /^pub\s+(?:const|struct|enum|fn|mod|use|trait|type)\b/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!declarationPattern.test(line)) {
      continue;
    }

    declarations.push({
      filePath,
      line: index + 1,
      name: line.trim(),
      documented: hasRustDocCommentAboveLine(lines, index),
    });
  }

  return declarations;
}

function hasRustDocCommentAboveLine(lines, declarationIndex) {
  let cursor = declarationIndex - 1;
  while (cursor >= 0) {
    const trimmed = lines[cursor].trim();
    if (trimmed === "" || trimmed.startsWith("#[")) {
      cursor -= 1;
      continue;
    }
    if (trimmed.startsWith("///") || trimmed.startsWith("//!")) {
      return true;
    }
    if (!trimmed.endsWith("*/")) {
      return false;
    }

    while (cursor >= 0) {
      const blockLine = lines[cursor].trim();
      if (blockLine.startsWith("/**")) {
        return true;
      }
      if (blockLine.startsWith("/*")) {
        return false;
      }
      cursor -= 1;
    }
    return false;
  }

  return false;
}

function hasDocCommentAboveLine(lines, declarationIndex, linePrefixes) {
  let cursor = declarationIndex - 1;
  while (cursor >= 0 && lines[cursor].trim() === "") {
    cursor -= 1;
  }

  if (cursor < 0) {
    return false;
  }

  const immediate = lines[cursor].trim();
  if (linePrefixes.some((prefix) => immediate.startsWith(prefix))) {
    return true;
  }

  if (!immediate.endsWith("*/")) {
    return false;
  }

  while (cursor >= 0) {
    const line = lines[cursor].trim();
    if (line.startsWith("/**")) {
      return true;
    }
    if (line.startsWith("/*")) {
      return false;
    }
    cursor -= 1;
  }

  return false;
}
