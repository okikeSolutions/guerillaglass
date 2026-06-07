import { describe, expect, test } from "bun:test";
import { EngineTransportLive } from "@guerillaglass/engine/client/EngineTransport";

describe("engine client package surface", () => {
  test("exposes Effect-native transport layer only", () => {
    expect(EngineTransportLive).toBeDefined();
  });
});
