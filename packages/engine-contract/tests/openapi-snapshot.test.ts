import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { EngineOpenApi } from "../src/openApi";

const packageRoot = resolve(import.meta.dirname, "..");

/**
 * Reads a package-local text fixture.
 *
 * @param pathSegments - Path segments below `packages/engine-contract`.
 * @returns The fixture contents as UTF-8 text.
 */
function readPackageFile(...pathSegments: string[]) {
  return readFileSync(resolve(packageRoot, ...pathSegments), "utf8");
}

describe("EngineOpenApi snapshot", () => {
  test("generated/engine.openapi.json is the deterministic OpenAPI snapshot", () => {
    const generated = readPackageFile("generated", "engine.openapi.json");
    const current = `${JSON.stringify(EngineOpenApi, null, 2)}\n`;

    expect(current).toBe(generated);
  });

  test("the snapshot is OpenAPI 3.1 and contains bearer security", () => {
    const generated = JSON.parse(readPackageFile("generated", "engine.openapi.json"));

    expect(generated.openapi).toBe("3.1.0");
    expect(generated.components.securitySchemes.EngineBearer).toMatchObject({
      type: "http",
      scheme: "Bearer",
    });
  });
});
