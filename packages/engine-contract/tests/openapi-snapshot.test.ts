import { describe, expect, test } from "vitest";
import { EngineOpenApi } from "../src/openApi";

describe("EngineOpenApi", () => {
  test("exposes the OpenAPI version and bearer scheme consumed by native generators", () => {
    expect(EngineOpenApi.openapi).toBe("3.1.0");
    expect(EngineOpenApi.components.securitySchemes.EngineBearer).toMatchObject({
      type: "http",
      scheme: "Bearer",
    });
  });

  test("keeps optional response properties out of the required schema keys", () => {
    const capturePreview = EngineOpenApi.components.schemas.CapturePreviewFrameResult;
    const actionResult = EngineOpenApi.components.schemas.ActionResult;
    if (!capturePreview || !actionResult) {
      throw new Error("EngineOpenApi omitted a schema required by the native clients.");
    }

    expect(capturePreview.required ?? []).not.toContain("frame");
    expect(actionResult.required ?? []).not.toContain("message");
  });
});
