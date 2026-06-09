import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import { engineEndpointInventory } from "@guerillaglass/engine-contract/endpointInventory";
import { projectRecentsResultSchema } from "@guerillaglass/engine-contract/domains/project";

function decodeSchemaSync<S extends Schema.Top>(schema: S, raw: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never, { errors: "all" })(raw) as Schema.Schema.Type<S>;
}

describe("engine HTTP contract", () => {
  test("declares the v2 HTTP endpoint inventory as protocol source of truth", () => {
    const names = new Set(engineEndpointInventory.map((endpoint) => endpoint.oldMethod));

    expect(names.has("engine.capabilities")).toBe(true);
    expect(names.has("capture.status")).toBe(true);
    expect(names.has("project.save")).toBe(true);
  });

  test("validates contract response payloads", () => {
    const recents = decodeSchemaSync(projectRecentsResultSchema, {
      items: [{ projectPath: "/tmp/fixture.gglassproj", displayName: "fixture", lastOpenedAt: "2026-02-19T10:00:00.000Z" }],
    });
    expect(recents.items[0]?.displayName).toBe("fixture");
  });
});
