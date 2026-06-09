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
  test("desktop source no longer depends on EngineTransport", () => {
    const sourceRoot = path.resolve(import.meta.dirname, "../src");
    const matches = sourceFiles(sourceRoot)
      .map((filePath) => ({ filePath, contents: readFileSync(filePath, "utf8") }))
      .filter(({ contents }) => /\bEngineTransport\b|capture\.statusStream|makeLayerEngineTransportBun/.test(contents))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(matches).toEqual([]);
  });
});
