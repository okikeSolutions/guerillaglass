import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { Layer } from "effect";
import { describe, test } from "vitest";
import { desktopCapabilityTokenSchema } from "@shared/bridge/desktopBridgeContract";
import { CapabilityTokenError } from "@shared/errors/desktopErrors";
import {
  deserializeBridgeError,
  serializeBridgeError,
} from "@shared/errors/desktopErrorSerialization";
import { makeCapabilityGrantService } from "../src/bun/security/DesktopCapabilities";

const testServices = Layer.mergeAll(NodeServices.layer, TestClock.layer());

describe("desktop capability grants", () => {
  it.effect("accepts a valid token for the matching scope and subject", () =>
    Effect.gen(function* () {
      const service = yield* makeCapabilityGrantService();
      const token = yield* service.mint({
        scope: "media:resolve-source",
        subject: "media:/tmp/recording.mov",
      });
      yield* service.consume({
        token,
        scope: "media:resolve-source",
        subject: "media:/tmp/recording.mov",
      });
    }).pipe(Effect.provide(testServices)),
  );

  it.effect("rejects missing or unknown tokens", () =>
    Effect.gen(function* () {
      const service = yield* makeCapabilityGrantService();
      const error = yield* Effect.flip(
        service.consume({
          token: desktopCapabilityTokenSchema.make("missing"),
          scope: "review:mutate",
          subject: "review:abc",
        }),
      );
      expect(error).toBeInstanceOf(CapabilityTokenError);
      expect(error.code).toBe("CAPABILITY_TOKEN_INVALID");
    }).pipe(Effect.provide(testServices)),
  );

  it.effect("rejects wrong scopes and wrong subjects", () =>
    Effect.gen(function* () {
      const service = yield* makeCapabilityGrantService();
      const token = yield* service.mint({
        scope: "media:resolve-source",
        subject: "media:/tmp/recording.mov",
      });
      const scopeError = yield* Effect.flip(
        service.consume({
          token,
          scope: "capture:resolve-preview-url",
          subject: "media:/tmp/recording.mov",
        }),
      );
      const subjectError = yield* Effect.flip(
        service.consume({
          token,
          scope: "media:resolve-source",
          subject: "media:/tmp/other.mov",
        }),
      );
      expect(scopeError).toBeInstanceOf(CapabilityTokenError);
      expect(subjectError).toBeInstanceOf(CapabilityTokenError);
    }).pipe(Effect.provide(testServices)),
  );

  it.effect("enforces single-use tokens", () =>
    Effect.gen(function* () {
      const service = yield* makeCapabilityGrantService();
      const token = yield* service.mint({
        scope: "review:mutate",
        subject: "review:abc",
        singleUse: true,
      });
      yield* service.consume({ token, scope: "review:mutate", subject: "review:abc" });
      const error = yield* Effect.flip(
        service.consume({ token, scope: "review:mutate", subject: "review:abc" }),
      );
      expect(error).toBeInstanceOf(CapabilityTokenError);
      expect(error.code).toBe("CAPABILITY_TOKEN_INVALID");
    }).pipe(Effect.provide(testServices)),
  );

  test("round-trips capability errors through bridge serialization", () => {
    const error = new CapabilityTokenError({
      code: "CAPABILITY_TOKEN_INVALID",
      description: "Capability token scope mismatch.",
    });

    const restored = deserializeBridgeError(serializeBridgeError(error));

    expect(restored).toBeInstanceOf(CapabilityTokenError);
    if (!(restored instanceof CapabilityTokenError)) {
      throw new Error("Wrong reconstructed error");
    }
    expect(restored.code).toBe("CAPABILITY_TOKEN_INVALID");
    expect(restored.message).toBe("Capability token scope mismatch.");
  });

  it.effect("rejects expired tokens", () =>
    Effect.gen(function* () {
      const service = yield* makeCapabilityGrantService();
      const token = yield* service.mint({
        scope: "capture:resolve-preview-url",
        subject: "capture:abc",
        ttlMs: 1,
      });
      yield* TestClock.adjust("5 millis");
      const error = yield* Effect.flip(
        service.consume({
          token,
          scope: "capture:resolve-preview-url",
          subject: "capture:abc",
        }),
      );
      expect(error).toBeInstanceOf(CapabilityTokenError);
    }).pipe(Effect.provide(testServices)),
  );
});
