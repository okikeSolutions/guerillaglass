import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      return sourceFiles(absolutePath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [absolutePath] : [];
  });
}

describe("desktop engine composition boundary", () => {
  test("only the composition root imports the low-level engine client", () => {
    const sourceRoot = path.resolve(import.meta.dirname, "../src");
    const matches = sourceFiles(sourceRoot).flatMap((filePath) => {
      const { program, errors } = parseSync(filePath, readFileSync(filePath, "utf8"));
      if (errors.length > 0) {
        throw new Error(`Unable to inspect desktop imports in ${filePath}: ${errors[0]?.message}`);
      }
      const importsEngineClient = program.body.some(
        (statement) =>
          statement.type === "ImportDeclaration" &&
          statement.source.value === "@guerillaglass/engine-client/service",
      );
      const relativePath = path.relative(sourceRoot, filePath);
      return importsEngineClient && relativePath !== "bun/app/index.ts" ? [relativePath] : [];
    });

    expect(matches).toEqual([]);
  });
});
