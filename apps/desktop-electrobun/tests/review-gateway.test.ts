import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import {
  reviewAuthTokenSchema,
  reviewIdSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
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
  if (!(failure.value instanceof ReviewBridgeError)) {
    throw new Error("Unexpected error type");
  }
  expect(failure.value.code).toBe(code);
}

describe("review gateway service", () => {
  it.effect("fails with REVIEW_BRIDGE_URL_MISSING when review Convex is not configured", () =>
    Effect.gen(function* () {
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => undefined,
      });

      const exit = yield* Effect.exit(
        gateway.sessionSnapshot({
          authToken: reviewAuthTokenSchema.make("token"),
          reviewId: reviewIdSchema.make("review-123"),
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
          authToken: reviewAuthTokenSchema.make("   "),
          reviewId: reviewIdSchema.make("review-123"),
        }),
      );
      expectReviewBridgeError(exit, "REVIEW_AUTH_TOKEN_MISSING");
    }),
  );

  it.effect("normalizes request failures into REVIEW_REQUEST_FAILED", () =>
    Effect.gen(function* () {
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => "https://example.convex.cloud",
        createClient: () => ({
          query: async () => {
            throw new Error("network unavailable");
          },
          mutation: async () => {
            throw new Error("network unavailable");
          },
        }),
      });

      const exit = yield* Effect.exit(
        gateway.sessionSnapshot({
          authToken: reviewAuthTokenSchema.make("token"),
          reviewId: reviewIdSchema.make("review-123"),
        }),
      );
      expectReviewBridgeError(exit, "REVIEW_REQUEST_FAILED");
    }),
  );
  it.effect("decodes remote review responses and rejects malformed successes", () =>
    Effect.gen(function* () {
      let payload: unknown = JSON.parse(
        readFileSync(
          new URL(
            "../../../packages/review-protocol/fixtures/review-session.snapshot.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const gateway = makeReviewGateway({
        resolveConvexUrl: () => "https://example.convex.cloud",
        createClient: (url) =>
          new ConvexHttpClient(url, {
            fetch: Object.assign(async () => Response.json({ status: "success", value: payload }), {
              preconnect: () => undefined,
            }),
          }),
      });
      const params = {
        authToken: reviewAuthTokenSchema.make("token"),
        reviewId: reviewIdSchema.make("review_5d4d3f1f"),
      };
      const snapshot = yield* gateway.sessionSnapshot(params);
      expect(snapshot.reviewId).toBe(params.reviewId);
      expect(snapshot.comments[0]?.authorName).toBe("Alex");
      payload = { reviewId: params.reviewId };
      expectReviewBridgeError(
        yield* Effect.exit(gateway.sessionSnapshot(params)),
        "REVIEW_REQUEST_FAILED",
      );
    }),
  );
});
