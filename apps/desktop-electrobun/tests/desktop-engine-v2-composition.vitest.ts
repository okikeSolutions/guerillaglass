import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      return sourceFiles(absolutePath);
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      return [absolutePath];
    }
    return [];
  });
}

describe("desktop engine v2 composition", () => {
  test("desktop source no longer depends on the legacy engine transport", () => {
    const sourceRoot = path.resolve(import.meta.dirname, "../src");
    const legacyServiceName = ["Engine", "Transport"].join("");
    const legacyLayerName = ["makeLayerEngine", "TransportBun"].join("");
    const legacyPattern = new RegExp(`\\b${legacyServiceName}\\b|capture\\.statusStream|${legacyLayerName}`);
    const matches = sourceFiles(sourceRoot)
      .map((filePath) => ({ filePath, contents: readFileSync(filePath, "utf8") }))
      .filter(({ contents }) => legacyPattern.test(contents))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(matches).toEqual([]);
  });

  test("desktop service logic depends on domain services instead of low-level EngineClient", () => {
    const sourceRoot = path.resolve(import.meta.dirname, "../src");
    const allowed = new Set(["bun/app/AppLayer.ts", "bun/app/index.ts"]);
    const matches = sourceFiles(sourceRoot)
      .map((filePath) => ({
        relativePath: path.relative(sourceRoot, filePath),
        contents: readFileSync(filePath, "utf8"),
      }))
      .filter(({ relativePath }) => !allowed.has(relativePath))
      .filter(({ contents }) => /@guerillaglass\/engine-client\/service["']|\bEngineClient\b/.test(contents))
      .map(({ relativePath }) => relativePath);

    expect(matches).toEqual([]);
  });
});
