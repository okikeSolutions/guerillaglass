/**
 * Validates generated OpenAPI against migration invariants for engine contract v2.
 *
 * @remarks
 * The checks intentionally enforce no explicit JSON `null`, deterministic generation,
 * bearer security on every operation, unique operation IDs, and complete legacy RPC
 * inventory coverage.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EngineOpenApi } from "../src/openApi";
import { engineEndpointInventory } from "../src/endpointInventory";

/**
 * Minimal OpenAPI operation shape used by the contract checker.
 */
type Operation = {
  readonly operationId?: string;
  readonly security?: ReadonlyArray<Record<string, readonly string[]>>;
};

const packageRoot = resolve(import.meta.dirname, "..");
const generatedPath = resolve(packageRoot, "generated/engine.openapi.json");
const generatedText = readFileSync(generatedPath, "utf8");
const expectedText = `${JSON.stringify(EngineOpenApi, null, 2)}\n`;

const failures: string[] = [];

if (generatedText !== expectedText) {
  failures.push("generated/engine.openapi.json is not deterministic/current; run bun run generate:openapi");
}

const openApi = JSON.parse(generatedText) as typeof EngineOpenApi;
const serialized = JSON.stringify(openApi);
if (serialized.includes('"null"')) {
  failures.push("OpenAPI contains explicit JSON null schema values; omit optional fields instead");
}

const operationKeys = new Set<string>();
const operationIds = new Set<string>();
const normalizedOperationIds = new Set<string>();

for (const [path, pathItem] of Object.entries(openApi.paths)) {
  for (const [method, operation] of Object.entries(pathItem as Record<string, Operation>)) {
    const upperMethod = method.toUpperCase();
    const key = `${upperMethod} ${path}`;
    if (operationKeys.has(key)) failures.push(`duplicate operation key: ${key}`);
    operationKeys.add(key);

    if (!operation.operationId) {
      failures.push(`missing operationId: ${key}`);
    } else if (operationIds.has(operation.operationId)) {
      failures.push(`duplicate operationId: ${operation.operationId}`);
    } else {
      operationIds.add(operation.operationId);
      normalizedOperationIds.add(operation.operationId.split(".").at(-1)!);
    }

    if (!operation.security?.some((entry) => "EngineBearer" in entry)) {
      failures.push(`missing EngineBearer security: ${key}`);
    }
  }
}

for (const item of engineEndpointInventory) {
  const key = `${item.method} ${item.path}`;
  if (!operationKeys.has(key)) {
    failures.push(`inventory endpoint not represented: ${item.oldMethod} -> ${key}`);
  }
  if (!normalizedOperationIds.has(item.operationId)) {
    failures.push(`inventory operationId not represented: ${item.oldMethod} -> ${item.operationId}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Contract checks passed (${operationIds.size} OpenAPI operations, ${engineEndpointInventory.length} inventory items).`);
