import { expect } from "vitest";
import { it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import {
  BridgeRequestLimits,
  layerBridgeRequestLimits,
} from "../src/bun/security/BridgeRequestLimits";

it.effect("keeps native selection pending beyond the direct capture deadline", () =>
  Effect.gen(function* () {
    const limits = yield* BridgeRequestLimits;
    const selected = yield* Deferred.make<number>();
    const request = yield* limits
      .guard("ggEngineStartWindowCapture", Deferred.await(selected), { windowId: 0 })
      .pipe(Effect.forkChild);
    yield* TestClock.adjust("35 seconds");
    yield* Deferred.succeed(selected, 42);
    expect(yield* Fiber.join(request)).toBe(42);
  }).pipe(Effect.provide(layerBridgeRequestLimits)),
);

it.effect("times out direct capture, finalizes it, and permits a retry", () =>
  Effect.gen(function* () {
    const limits = yield* BridgeRequestLimits;
    const finalized = yield* Ref.make(0);
    const request = yield* limits
      .guard(
        "ggEngineStartWindowCapture",
        Effect.never.pipe(Effect.ensuring(Ref.update(finalized, (count) => count + 1))),
        { windowId: 42 },
      )
      .pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("21 seconds");
    expect((yield* Fiber.join(request))._tag).toBe("BridgeRequestTimeoutError");
    expect(yield* Ref.get(finalized)).toBe(1);
    expect(
      yield* limits.guard("ggEngineStartWindowCapture", Effect.succeed(42), { windowId: 42 }),
    ).toBe(42);
  }).pipe(Effect.provide(layerBridgeRequestLimits)),
);

it.effect("bounds abandoned picker requests and finalizes them", () =>
  Effect.gen(function* () {
    const limits = yield* BridgeRequestLimits;
    const finalized = yield* Ref.make(0);
    const request = yield* limits
      .guard(
        "ggEngineStartWindowCapture",
        Effect.never.pipe(Effect.ensuring(Ref.update(finalized, (count) => count + 1))),
        { windowId: 0 },
      )
      .pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("10 minutes");
    expect(request.pollUnsafe()).toBeUndefined();
    yield* TestClock.adjust("1 minute");
    expect((yield* Fiber.join(request))._tag).toBe("BridgeRequestTimeoutError");
    expect(yield* Ref.get(finalized)).toBe(1);
  }).pipe(Effect.provide(layerBridgeRequestLimits)),
);
