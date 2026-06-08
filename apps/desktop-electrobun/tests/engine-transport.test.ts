import { describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { EngineTransport, type EngineTransportService } from "@guerillaglass/engine/client/service";

const testEngine: EngineTransportService = {
  "system.ping": () =>
    Effect.succeed({
      app: "guerillaglass",
      engineVersion: "0.0.0-test",
      protocolVersion: "2",
      platform: "test",
    }),
  "engine.capabilities": () =>
    Effect.succeed({
      protocolVersion: "2",
      platform: "test",
      phase: "stub" as const,
      capture: { display: true, window: true, systemAudio: false, microphone: true },
      recording: { inputTracking: true },
      export: { presets: true, cutPlan: false },
      project: { openSave: true },
      agent: {
        enabled: false,
        localModel: false,
        importedTranscript: true,
        destructiveApply: false,
      },
    }),
} as unknown as EngineTransportService;

describe("engine transport service", () => {
  test("exposes the raw Effect RPC client surface", async () => {
    const runtime = ManagedRuntime.make(Layer.succeed(EngineTransport, testEngine));
    try {
      const ping = await runtime.runPromise(
        Effect.flatMap(EngineTransport, (transport) => transport["system.ping"](undefined)),
      );
      expect(ping.protocolVersion).toBe("2");
    } finally {
      await runtime.dispose();
    }
  });
});
