import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "vitest";
import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { actionResultSchema } from "../src/domains/permissions";
import { capturePreviewFrameResultSchema } from "../src/domains/capture";
import { displaySourceSchema } from "../src/domains/sources";
import { projectRecentItemSchema } from "../src/domains/project";

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
function decodeSync<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  value: unknown,
): S["Type"] {
  return Schema.decodeUnknownSync(schema)(value);
}

/**
 * Encodes a decoded value through an Effect schema.
 *
 * @param schema - Schema to encode with.
 * @param value - Decoded value.
 * @returns The encoded JSON value.
 */
function encodeSync<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  value: S["Type"],
): unknown {
  return Schema.encodeUnknownSync(schema)(value);
}

describe("encoded JSON semantics", () => {
  it.effect("optional fields are represented by omitted keys, not explicit null", () =>
    Effect.gen(function* () {
      const fixture = readFixture("capture-preview-frame-omitted.json");
      const decoded = decodeSync(capturePreviewFrameResultSchema, fixture);

      expect(decoded).toEqual({});
      expect(encodeSync(capturePreviewFrameResultSchema, decoded)).toEqual({});

      const nullExit = yield* Effect.exit(
        Schema.decodeUnknownEffect(capturePreviewFrameResultSchema)({ frame: null }),
      );
      expect(nullExit._tag).toBe("Failure");
    }),
  );

  test("optional action messages are omitted when absent", () => {
    const fixture = readFixture("action-result-message-omitted.json");
    const decoded = decodeSync(actionResultSchema, fixture);

    expect(decoded).toEqual({ success: true });
    expect(encodeSync(actionResultSchema, decoded)).toEqual({ success: true });
  });

  it.effect("literal unions encode as JSON and reject unsupported frame rates", () =>
    Effect.gen(function* () {
      const fixture = readFixture("source-display.json");
      const decoded = decodeSync(displaySourceSchema, fixture);

      expect(decoded.displayName).toBe("Built-in Display");
      expect(encodeSync(displaySourceSchema, decoded)).toEqual(fixture);

      const invalidExit = yield* Effect.exit(
        Schema.decodeUnknownEffect(displaySourceSchema)({
          ...decoded,
          supportedCaptureFrameRates: [25],
        }),
      );
      expect(invalidExit._tag).toBe("Failure");
    }),
  );

  it.effect("path-like wire values round-trip and reject an empty project path", () =>
    Effect.gen(function* () {
      const fixture = readFixture("project-recent-item-path-string.json");
      const decoded = decodeSync(projectRecentItemSchema, fixture);

      expect(decoded.projectPath).toBe("/tmp/demo.gglassproj");
      expect(encodeSync(projectRecentItemSchema, decoded)).toEqual(fixture);

      const emptyPathExit = yield* Effect.exit(
        Schema.decodeEffect(projectRecentItemSchema)({
          ...decoded,
          projectPath: "",
        }),
      );
      expect(emptyPathExit._tag).toBe("Failure");
    }),
  );
});
