import { describe, expect, test } from "bun:test";
import { analyzeTypeScriptDeclarations } from "./typescript_source_analysis.mjs";

describe("TypeScript documentation source analysis", () => {
  test("preserves exported declaration and JSDoc semantics without the TypeScript compiler API", () => {
    const source = `/** documented constant */
export const value = 1;

/** documented decorator */
@sealed
export class Service {}

/** decorator after export */
export @sealed class ExportDecorated {}

/** default decorator after export */
export default @sealed class DefaultDecorated {}

/** documented ambient function */
export declare function load(): void;

// Not JSDoc.
export interface Undocumented {}

const local = 1;
export { local };
`;

    expect(analyzeTypeScriptDeclarations("fixture.ts", source)).toEqual([
      {
        filePath: "fixture.ts",
        line: 2,
        name: "export value",
        documented: true,
      },
      {
        filePath: "fixture.ts",
        line: 5,
        name: "export Service",
        documented: true,
      },
      {
        filePath: "fixture.ts",
        line: 9,
        name: "export ExportDecorated",
        documented: true,
      },
      {
        filePath: "fixture.ts",
        line: 12,
        name: "export DefaultDecorated",
        documented: true,
      },
      {
        filePath: "fixture.ts",
        line: 15,
        name: "export load",
        documented: true,
      },
      {
        filePath: "fixture.ts",
        line: 18,
        name: "export Undocumented",
        documented: false,
      },
    ]);
  });

  test("rejects malformed TypeScript instead of silently lowering coverage", () => {
    expect(() => analyzeTypeScriptDeclarations("broken.ts", "export const = ;")).toThrow(
      "Unable to parse broken.ts",
    );
  });
});
