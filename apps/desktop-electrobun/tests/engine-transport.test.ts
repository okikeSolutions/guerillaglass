import { describe, expect, test } from "vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { EngineClient, type EngineClientService } from "@guerillaglass/engine-client/service";

const testEngine: EngineClientService = {
  systemPing: Effect.succeed({
    app: "guerillaglass",
    engineVersion: "0.0.0-test",
    protocolVersion: "2",
    platform: "test",
  }),
  engineCapabilities: Effect.succeed({
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
} as unknown as EngineClientService;

describe("engine client service", () => {
  test("exposes the HTTP engine client surface", async () => {
    const runtime = ManagedRuntime.make(Layer.succeed(EngineClient, testEngine));
    try {
      const ping = await runtime.runPromise(
        Effect.flatMap(EngineClient, (client) => client.systemPing),
      );
      expect(ping.protocolVersion).toBe("2");
    } finally {
      await runtime.dispose();
    }
  });
});
