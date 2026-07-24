import { parseSync } from "oxc-parser";

export function analyzeTypeScriptDeclarations(filePath, sourceText) {
  const { program, comments, errors } = parseSync(filePath, sourceText);
  if (errors.length > 0) {
    throw new Error(`Unable to parse ${filePath}: ${errors[0].message}`);
  }

  const declarations = [];
  for (const statement of program.body) {
    if (
      statement.type !== "ExportNamedDeclaration" &&
      statement.type !== "ExportDefaultDeclaration"
    ) {
      continue;
    }

    const declaration = statement.declaration;
    if (!declaration) {
      continue;
    }

    const declarationStart = Math.min(
      statement.start,
      declaration.decorators?.[0]?.start ?? statement.start,
    );
    const documented = hasDocCommentAboveNode(sourceText, comments, declarationStart);
    const line = lineNumberAtOffset(sourceText, declarationStart);

    if (declaration.type === "VariableDeclaration") {
      const names = declaration.declarations
        .map((item) => sourceText.slice(item.id.start, item.id.end))
        .join(", ");
      declarations.push({ filePath, line, name: `export ${names}`, documented });
      continue;
    }

    if (
      declaration.type === "FunctionDeclaration" ||
      declaration.type === "TSDeclareFunction" ||
      declaration.type === "ClassDeclaration"
    ) {
      const name = declaration.id?.name ?? "default";
      declarations.push({ filePath, line, name: `export ${name}`, documented });
      continue;
    }

    if (
      declaration.type === "TSInterfaceDeclaration" ||
      declaration.type === "TSTypeAliasDeclaration" ||
      declaration.type === "TSEnumDeclaration"
    ) {
      declarations.push({ filePath, line, name: `export ${declaration.id.name}`, documented });
    }
  }

  return declarations;
}

function hasDocCommentAboveNode(sourceText, comments, nodeStart) {
  const lastComment = comments.filter((comment) => comment.end <= nodeStart).at(-1);
  if (!lastComment || lastComment.type !== "Block" || !lastComment.value.startsWith("*")) {
    return false;
  }
  return sourceText.slice(lastComment.end, nodeStart).trim().length === 0;
}

function lineNumberAtOffset(sourceText, offset) {
  return sourceText.slice(0, offset).split(/\r?\n/).length;
}
