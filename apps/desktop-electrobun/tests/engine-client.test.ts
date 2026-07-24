import { describe, expect, test } from "vitest";
import { layerEngineClientBun } from "@guerillaglass/engine-client/service";

describe("engine client package surface", () => {
  test("exposes the Node-platform native HTTP client layer under Bun", () => {
    expect(layerEngineClientBun).toBeDefined();
  });
});
