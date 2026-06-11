import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Schema } from "effect";
import { captureStatusResultSchema } from "../src/domains/capture";
import { EngineUnauthorizedError } from "../src/errors";
import { captureStartDisplayPayloadSchema } from "../src/httpApi";

const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../docs/fixtures/engine-contract-v2/golden",
);

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, name), "utf8"));
}

describe("golden cross-language fixtures", () => {
  test("TS encodes capture start-display request fixture", () => {
    const decoded = Schema.decodeUnknownSync(captureStartDisplayPayloadSchema)(
      readFixture("capture-start-display.request.json"),
    );
    const encoded = Schema.encodeUnknownSync(Schema.toCodecJson(captureStartDisplayPayloadSchema))(
      decoded,
    );
    expect(encoded).toEqual(readFixture("capture-start-display.request.json"));
  });

  test("TS decodes capture status response fixture", () => {
    const decoded = Schema.decodeUnknownSync(captureStatusResultSchema)(
      readFixture("capture-status.response.json"),
    );
    expect(decoded.isRunning).toBe(true);
    expect(decoded.telemetry.achievedFps).toBe(30);
    const encoded = Schema.encodeUnknownSync(Schema.toCodecJson(captureStatusResultSchema))(
      decoded,
    );
    expect(encoded).toEqual(readFixture("capture-status.response.json"));
  });

  test("TS decodes unauthorized error response fixture", () => {
    const decoded = Schema.decodeUnknownSync(EngineUnauthorizedError)(
      readFixture("engine-unauthorized.response.json"),
    );
    expect(decoded.code).toBe("permission_denied");
  });
});
