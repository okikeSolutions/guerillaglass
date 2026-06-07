import { describe, expect, test } from "bun:test";
import { EngineTransportBunLive } from "@guerillaglass/engine/client/liveBun";

describe("engine client package surface", () => {
  test("exposes Bun-backed native transport layer", () => {
    expect(EngineTransportBunLive).toBeDefined();
  });
});
