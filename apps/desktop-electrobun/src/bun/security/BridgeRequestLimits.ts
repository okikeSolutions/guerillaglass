import { Context, Duration, Effect, Layer, Schema, Semaphore } from "effect";
import { RateLimiter } from "effect/persistence";
import type { BridgeRequestName } from "../../shared/bridge/desktopBridgeContract";
import {
  BridgeRequestLimitError,
  BridgeRequestTimeoutError,
} from "../../shared/errors/desktopErrors";
import { bridgeRequestTimeoutFor } from "./BridgeRequestTimeouts";

const BridgeLimitRule = Schema.Struct({
  maxRequests: Schema.Finite,
  windowMs: Schema.Finite,
  maxConcurrent: Schema.Finite,
});
interface BridgeLimitRule extends Schema.Schema.Type<typeof BridgeLimitRule> {}

const defaultBridgeLimitRule: BridgeLimitRule = {
  maxRequests: 120,
  windowMs: 60_000,
  maxConcurrent: 8,
};

const bridgeLimitRules: Partial<Record<BridgeRequestName, BridgeLimitRule>> = {
  ggEngineRunExport: { maxRequests: 4, windowMs: 60_000, maxConcurrent: 1 },
  ggEngineRunCutPlanExport: { maxRequests: 4, windowMs: 60_000, maxConcurrent: 1 },
  ggEngineAgentRun: { maxRequests: 6, windowMs: 60_000, maxConcurrent: 1 },
  ggEngineAgentApply: { maxRequests: 6, windowMs: 60_000, maxConcurrent: 1 },
  ggReviewCreateComment: { maxRequests: 20, windowMs: 60_000, maxConcurrent: 2 },
  ggReviewSetWorkflowStatus: { maxRequests: 20, windowMs: 60_000, maxConcurrent: 2 },
  ggResolveMediaSourceURL: { maxRequests: 60, windowMs: 60_000, maxConcurrent: 4 },
  ggResolveCapturePreviewURL: { maxRequests: 12, windowMs: 60_000, maxConcurrent: 2 },
  ggReadTextFile: { maxRequests: 30, windowMs: 60_000, maxConcurrent: 2 },
};

type BridgeRequestLimitsService = {
  readonly guard: <A, E, R>(
    name: BridgeRequestName,
    effect: Effect.Effect<A, E, R>,
    params?: unknown,
  ) => Effect.Effect<A, E | BridgeRequestLimitError | BridgeRequestTimeoutError, R>;
};

export class BridgeRequestLimits extends Context.Service<
  BridgeRequestLimits,
  BridgeRequestLimitsService
>()("@guerillaglass/desktop/BridgeRequestLimits") {}

function ruleFor(name: BridgeRequestName): BridgeLimitRule {
  return bridgeLimitRules[name] ?? defaultBridgeLimitRule;
}

const layerEffectRateLimiter = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

export const layerBridgeRequestLimits = Layer.effect(
  BridgeRequestLimits,
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.RateLimiter;
    const semaphores = new Map<BridgeRequestName, Semaphore.Semaphore>();

    const checkRateLimit = Effect.fn("BridgeRequestLimits.checkRateLimit")((
      name: BridgeRequestName,
    ): Effect.Effect<void, BridgeRequestLimitError> => {
      const rule = ruleFor(name);
      return limiter
        .consume({
          key: `desktop-bridge:${name}`,
          limit: rule.maxRequests,
          window: Duration.millis(rule.windowMs),
          algorithm: "fixed-window",
          onExceeded: "fail",
        })
        .pipe(
          Effect.asVoid,
          Effect.mapError(
            (error) =>
              new BridgeRequestLimitError({
                requestName: name,
                retryAfterMs:
                  error.reason._tag === "RateLimitExceeded"
                    ? Duration.toMillis(error.reason.retryAfter)
                    : rule.windowMs,
              }),
          ),
        );
    });

    const semaphoreFor = (name: BridgeRequestName) => {
      const existing = semaphores.get(name);
      if (existing) {
        return existing;
      }
      const semaphore = Semaphore.makeUnsafe(ruleFor(name).maxConcurrent);
      semaphores.set(name, semaphore);
      return semaphore;
    };

    return BridgeRequestLimits.of({
      guard: Effect.fn("BridgeRequestLimits.guard")(
        <A, E, R>(name: BridgeRequestName, effect: Effect.Effect<A, E, R>, params?: unknown) =>
          Effect.gen(function* () {
            yield* checkRateLimit(name);
            const timeout = bridgeRequestTimeoutFor(name, params);
            return yield* semaphoreFor(name)
              .withPermit(effect)
              .pipe(
                Effect.timeoutOrElse({
                  duration: timeout,
                  orElse: () =>
                    Effect.fail(
                      new BridgeRequestTimeoutError({
                        requestName: name,
                        timeout,
                      }),
                    ),
                }),
              );
          }),
      ),
    });
  }).pipe(Effect.provide(layerEffectRateLimiter)),
);
