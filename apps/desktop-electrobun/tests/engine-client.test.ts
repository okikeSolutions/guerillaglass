import { describe, expect, test } from "bun:test";
import { layerEngineClientBun } from "@guerillaglass/engine-client/service";

describe("engine client package surface", () => {
  test("exposes Bun-backed native HTTP client layer", () => {
    expect(layerEngineClientBun).toBeDefined();
  });
});
