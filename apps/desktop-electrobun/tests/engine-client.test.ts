import { describe, expect, test } from "bun:test";
import { layerEngineTransportBun } from "@guerillaglass/engine/client/liveBun";

describe("engine client package surface", () => {
  test("exposes Bun-backed native transport layer", () => {
    expect(layerEngineTransportBun).toBeDefined();
  });
});
