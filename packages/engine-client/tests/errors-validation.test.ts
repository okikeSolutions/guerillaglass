import { describe, expect, test } from "vitest";
import {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
  messageFromUnknownError,
} from "../src/errors";
import { formatValidationIssue } from "../src/validation";

describe("engine-client validation formatting", () => {
  test("formats issue paths and fallback paths", () => {
    expect(formatValidationIssue({ path: ["capture", 0, "fps"], message: "must be finite" })).toBe(
      "capture.0.fps: must be finite",
    );
    expect(formatValidationIssue({ path: [], message: "required" }, "requestBody")).toBe(
      "requestBody: required",
    );
  });
});

describe("engine-client errors", () => {
  test("formats infrastructure and operation errors", () => {
    expect(
      new EngineClientError({
        code: "ENGINE_PROCESS_UNAVAILABLE",
        description: "Native engine is unavailable.",
      }).message,
    ).toBe("Native engine is unavailable.");

    expect(
      new EngineOperationError({ operation: "capture.status", description: "failed" }).message,
    ).toBe("failed");
    expect(
      new EngineResponseError({ code: "invalid_params", description: "bad fps" }).message,
    ).toBe("invalid_params: bad fps");
    expect(new JsonParseError({ source: "readiness" }).message).toBe("Invalid readiness JSON.");
  });

  test("formats request validation errors with the first three issues", () => {
    const error = new EngineRequestValidationError({
      method: "capture.startDisplay",
      hint: "Check the OpenAPI contract.",
      issues: [
        { path: ["displayId"], message: "must be a number" },
        { path: ["captureFps"], message: "unsupported frame rate" },
        { path: ["output", "url"], message: "must be a file URL" },
        { path: ["extra"], message: "should be omitted" },
      ],
    });

    expect(error.message).toContain(
      "invalid_params: capture.startDisplay request validation failed",
    );
    expect(error.message).toContain("displayId: must be a number");
    expect(error.message).toContain("captureFps: unsupported frame rate");
    expect(error.message).toContain("output.url: must be a file URL");
    expect(error.message).not.toContain("extra: should be omitted");
    expect(error.message).toContain("Check the OpenAPI contract.");
  });

  test("formats contract decode errors with and without issues", () => {
    expect(
      new ContractDecodeError({
        contract: "CaptureStatusResult",
        issues: [],
        cause: "decode failed",
      }).message,
    ).toBe("Invalid CaptureStatusResult payload.");

    expect(
      new ContractDecodeError({
        contract: "CaptureStatusResult",
        issues: [{ path: ["isRunning"], message: "must be boolean" }],
        cause: "decode failed",
      }).message,
    ).toBe("Invalid CaptureStatusResult payload (isRunning: must be boolean).");
  });

  test("extracts useful messages from unknown errors", () => {
    expect(messageFromUnknownError(new Error("boom"), "fallback")).toBe("boom");
    expect(messageFromUnknownError("bad input", "fallback")).toBe("bad input");
    expect(messageFromUnknownError("   ", "fallback")).toBe("fallback");
    expect(messageFromUnknownError(null, "fallback")).toBe("fallback");
  });
});
