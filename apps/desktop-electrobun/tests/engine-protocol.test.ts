import { describe, expect, test } from "vitest";
import { Schema } from "effect";

import { EngineOpenApi } from "@guerillaglass/engine-contract/openApi";
import { projectRecentsResultSchema } from "@guerillaglass/engine-contract/domains/project";

function decodeSchemaSync<S extends Schema.Top>(schema: S, raw: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never, { errors: "all" })(raw) as Schema.Schema.Type<S>;
}

describe("engine HTTP contract", () => {
  test("declares v2 HTTP endpoints as protocol source of truth", () => {
    expect(EngineOpenApi.paths["/v1/engine/capabilities"]?.get?.operationId).toBe(
      "system.engineCapabilities",
    );
    expect(EngineOpenApi.paths["/v1/capture/status"]?.get?.operationId).toBe(
      "capture.captureStatus",
    );
    expect(EngineOpenApi.paths["/v1/project/save"]?.post?.operationId).toBe("project.projectSave");
  });

  test("validates contract response payloads", () => {
    const recents = decodeSchemaSync(projectRecentsResultSchema, {
      items: [
        {
          projectPath: "/tmp/fixture.gglassproj",
          displayName: "fixture",
          lastOpenedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
    });
    expect(recents.items[0]?.displayName).toBe("fixture");
  });
});
