import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { Effect, Schema } from "effect";
import { actionResultSchema } from "../src/domains/permissions";
import { capturePreviewFrameResultSchema } from "../src/domains/capture";
import { displaySourceSchema } from "../src/domains/sources";
import { projectRecentItemSchema } from "../src/domains/project";
import { EngineOpenApi } from "../src/openApi";

const fixtureRoot = resolve(import.meta.dirname, "fixtures", "encoded-json");

/**
 * Reads an encoded JSON fixture for contract semantics tests.
 *
 * @param name - Fixture file name under `tests/fixtures/encoded-json`.
 * @returns Parsed JSON fixture contents.
 */
function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, name), "utf8"));
}

/**
 * Decodes an unknown JSON value through an Effect schema.
 *
 * @param schema - Schema to decode with.
 * @param value - Encoded JSON value.
 * @returns The decoded value.
 */
function decodeSync<S extends Schema.Top>(schema: S, value: unknown): Schema.Schema.Type<S> {
  return Effect.runSync(
    Schema.decodeUnknownEffect(schema)(value) as Effect.Effect<Schema.Schema.Type<S>, never, never>,
  );
}

/**
 * Encodes a decoded value through an Effect schema.
 *
 * @param schema - Schema to encode with.
 * @param value - Decoded value.
 * @returns The encoded JSON value.
 */
function encodeSync<S extends Schema.Top>(schema: S, value: Schema.Schema.Type<S>): unknown {
  return Effect.runSync(
    Schema.encodeUnknownEffect(schema)(value) as Effect.Effect<unknown, never, never>,
  );
}

describe("encoded JSON semantics", () => {
  test("optional fields are represented by omitted keys, not explicit null", () => {
    const fixture = readFixture("capture-preview-frame-omitted.json");
    const decoded = decodeSync(capturePreviewFrameResultSchema, fixture);

    expect(decoded).toEqual({});
    expect(encodeSync(capturePreviewFrameResultSchema, decoded)).toEqual({});

    const nullExit = Effect.runSyncExit(
      Schema.decodeUnknownEffect(capturePreviewFrameResultSchema)({ frame: null }),
    );
    expect(nullExit._tag).toBe("Failure");
  });

  test("optional action messages are omitted when absent", () => {
    const fixture = readFixture("action-result-message-omitted.json");
    const decoded = decodeSync(actionResultSchema, fixture);

    expect(decoded).toEqual({ success: true });
    expect(encodeSync(actionResultSchema, decoded)).toEqual({ success: true });
  });

  test("literal unions encode as JSON strings", () => {
    const fixture = readFixture("source-display.json");
    const decoded = decodeSync(displaySourceSchema, fixture);

    expect(decoded.displayName).toBe("Built-in Display");
    expect(encodeSync(displaySourceSchema, decoded)).toEqual(fixture);

    const invalidExit = Effect.runSyncExit(
      Schema.decodeUnknownEffect(displaySourceSchema)({
        ...(fixture as object),
        supportedCaptureFrameRates: [25],
      }) as Effect.Effect<unknown, unknown, never>,
    );
    expect(invalidExit._tag).toBe("Failure");
  });

  test("path-like values are plain non-empty JSON strings", () => {
    const fixture = readFixture("project-recent-item-path-string.json");
    const decoded = decodeSync(projectRecentItemSchema, fixture);

    expect(decoded.projectPath).toBe("/tmp/demo.gglassproj");
    expect(encodeSync(projectRecentItemSchema, decoded)).toEqual(fixture);

    const emptyPathExit = Effect.runSyncExit(
      Schema.decodeUnknownEffect(projectRecentItemSchema)({
        ...(fixture as object),
        projectPath: "",
      }),
    );
    expect(emptyPathExit._tag).toBe("Failure");
  });

  test("OpenAPI output contains no explicit null schema and marks optional keys as not required", () => {
    const serialized = JSON.stringify(EngineOpenApi);
    const schemas = EngineOpenApi.components.schemas as Record<
      string,
      { readonly required?: ReadonlyArray<string> }
    >;

    expect(serialized.includes('"null"')).toBe(false);
    expect(schemas.CapturePreviewFrameResult?.required ?? []).not.toContain("frame");
    expect(schemas.ActionResult?.required ?? []).not.toContain("message");
  });

  test("void/no-body endpoints do not emit OpenAPI request bodies", () => {
    expect(EngineOpenApi.paths["/v1/capture/stop"]!.post!.requestBody).toBeUndefined();
    expect(EngineOpenApi.paths["/v1/recording/stop"]!.post!.requestBody).toBeUndefined();
    expect(EngineOpenApi.paths["/v1/system/ping"]!.get!.requestBody).toBeUndefined();
    expect(EngineOpenApi.paths["/v1/capture/start-window"]!.post!.requestBody).toBeDefined();
  });
});
