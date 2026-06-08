import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { ReviewBridgeError } from "@shared/errors/desktopErrors";
import { makeReviewGateway } from "../src/bun/review/service";

function expectReviewBridgeError(
  exit: Exit.Exit<unknown, unknown>,
  code: ReviewBridgeError["code"],
) {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected review bridge request to fail");
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isNone(failure)) {
    throw Cause.squash(exit.cause);
  }
  expect(failure.value).toBeInstanceOf(ReviewBridgeError);
  expect((failure.value as ReviewBridgeError).code).toBe(code);
}

describe("review gateway service", () => {
  it.effect("fails with REVIEW_BRIDGE_URL_MISSING when review Convex is not configured", () =>
    Effect.gen(function* () {
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => undefined,
      });

      const exit = yield* Effect.exit(
        gateway.sessionSnapshot({
          authToken: "token",
          reviewId: "review-123",
        }),
      );
      expectReviewBridgeError(exit, "REVIEW_BRIDGE_URL_MISSING");
    }),
  );

  it.effect("fails with REVIEW_AUTH_TOKEN_MISSING when auth token is blank", () =>
    Effect.gen(function* () {
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => "https://example.convex.cloud",
      });

      const exit = yield* Effect.exit(
        gateway.sessionSnapshot({
          authToken: "   ",
          reviewId: "review-123",
        }),
      );
      expectReviewBridgeError(exit, "REVIEW_AUTH_TOKEN_MISSING");
    }),
  );

  it.effect("normalizes request failures into REVIEW_REQUEST_FAILED", () =>
    Effect.gen(function* () {
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => "https://example.convex.cloud",
        createClient: () =>
          ({
            query: async () => {
              throw new Error("network unavailable");
            },
            mutation: async () => {
              throw new Error("network unavailable");
            },
          }) as never,
      });

      const exit = yield* Effect.exit(
        gateway.sessionSnapshot({
          authToken: "token",
          reviewId: "review-123",
        }),
      );
      expectReviewBridgeError(exit, "REVIEW_REQUEST_FAILED");
    }),
  );
});
