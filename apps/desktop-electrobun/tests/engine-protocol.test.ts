import { describe, expect, test } from "bun:test";
import { Schema } from "effect";

import { EngineRpcs } from "@guerillaglass/engine/protocol/rpc/group";
import { engineRpcErrorSchema } from "@guerillaglass/engine/protocol/rpc/errors";
import { projectRecentsResultSchema } from "@guerillaglass/engine/protocol/domains/project";

const fixtureDir = new URL("../../../packages/engine/fixtures/", import.meta.url);

function decodeSchemaSync<S extends Schema.Top>(schema: S, raw: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never, { errors: "all" })(raw) as Schema.Schema.Type<S>;
}

describe("engine Effect RPC protocol", () => {
  test("declares Effect RPC group as protocol source of truth", () => {
    expect(EngineRpcs.requests.has("engine.capabilities")).toBe(true);
    expect(EngineRpcs.requests.has("capture.status")).toBe(true);
    expect(EngineRpcs.requests.has("project.save")).toBe(true);
  });

  test("uses stable Guerillaglass wire envelopes for native fixtures", async () => {
    const request = await Bun.file(new URL("engine-capabilities.request.json", fixtureDir)).json();
    expect(request).toMatchObject({
      type: "request",
      id: "1",
      method: "engine.capabilities",
      params: {},
    });
  });

  test("validates Effect RPC typed errors", () => {
    const error = decodeSchemaSync(engineRpcErrorSchema, {
      _tag: "EngineRpcError",
      code: "unsupported_method",
      message: "Unsupported method",
    });
    expect(error.code).toBe("unsupported_method");
  });

  test("fixtures validate stable wire response payloads", async () => {
    const response = await Bun.file(new URL("project-recents.response.json", fixtureDir)).json();
    expect(response).toHaveProperty("type", "response");
    expect(response).toHaveProperty("result");
    const recents = decodeSchemaSync(projectRecentsResultSchema, response.result);
    expect(recents.items[0]?.displayName).toBe("fixture");
  });
});
