import { Effect, Exit } from "effect";
import { describe, expect, test } from "vitest";
import { CapabilityTokenError } from "@shared/errors/desktopErrors";
import {
  deserializeBridgeError,
  serializeBridgeError,
} from "@shared/errors/desktopErrorSerialization";
import { makeCapabilityGrantService } from "../src/bun/security/DesktopCapabilities";

describe("desktop capability grants", () => {
  test("accepts a valid token for the matching scope and subject", async () => {
    const service = makeCapabilityGrantService();
    const token = await Effect.runPromise(
      service.mint({ scope: "media:resolve-source", subject: "media:/tmp/recording.mov" }),
    );

    const exit = await Effect.runPromiseExit(
      service.consume({
        token,
        scope: "media:resolve-source",
        subject: "media:/tmp/recording.mov",
      }),
    );

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  test("rejects missing or unknown tokens", async () => {
    const service = makeCapabilityGrantService();

    await expect(
      Effect.runPromise(
        service.consume({
          token: "missing",
          scope: "review:mutate",
          subject: "review:abc",
        }),
      ),
    ).rejects.toBeInstanceOf(CapabilityTokenError);
  });

  test("rejects wrong scopes and wrong subjects", async () => {
    const service = makeCapabilityGrantService();
    const token = await Effect.runPromise(
      service.mint({ scope: "media:resolve-source", subject: "media:/tmp/recording.mov" }),
    );

    await expect(
      Effect.runPromise(
        service.consume({
          token,
          scope: "capture:resolve-preview-url",
          subject: "media:/tmp/recording.mov",
        }),
      ),
    ).rejects.toBeInstanceOf(CapabilityTokenError);

    await expect(
      Effect.runPromise(
        service.consume({
          token,
          scope: "media:resolve-source",
          subject: "media:/tmp/other.mov",
        }),
      ),
    ).rejects.toBeInstanceOf(CapabilityTokenError);
  });

  test("enforces single-use tokens", async () => {
    const service = makeCapabilityGrantService();
    const token = await Effect.runPromise(
      service.mint({ scope: "review:mutate", subject: "review:abc", singleUse: true }),
    );

    await Effect.runPromise(
      service.consume({ token, scope: "review:mutate", subject: "review:abc" }),
    );
    await expect(
      Effect.runPromise(service.consume({ token, scope: "review:mutate", subject: "review:abc" })),
    ).rejects.toBeInstanceOf(CapabilityTokenError);
  });

  test("round-trips capability errors through bridge serialization", () => {
    const error = new CapabilityTokenError({
      code: "CAPABILITY_TOKEN_INVALID",
      description: "Capability token scope mismatch.",
    });

    const restored = deserializeBridgeError(serializeBridgeError(error));

    expect(restored).toBeInstanceOf(CapabilityTokenError);
    expect((restored as CapabilityTokenError).code).toBe("CAPABILITY_TOKEN_INVALID");
    expect(restored.message).toBe("Capability token scope mismatch.");
  });

  test("rejects expired tokens", async () => {
    const service = makeCapabilityGrantService();
    const token = await Effect.runPromise(
      service.mint({ scope: "capture:resolve-preview-url", subject: "capture:abc", ttlMs: 1 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(
      Effect.runPromise(
        service.consume({
          token,
          scope: "capture:resolve-preview-url",
          subject: "capture:abc",
        }),
      ),
    ).rejects.toBeInstanceOf(CapabilityTokenError);
  });
});
