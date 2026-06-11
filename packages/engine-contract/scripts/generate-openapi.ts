/**
 * Generates the checked-in OpenAPI artifact from the Effect HttpApi source of truth.
 *
 * @remarks
 * Run with `bun run generate:openapi` from `packages/engine-contract` whenever
 * schemas or endpoint definitions change.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EngineOpenApi } from "../src/openApi";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(packageRoot, "generated/engine.openapi.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(EngineOpenApi, null, 2)}\n`);
console.log(`Generated ${outputPath}`);
