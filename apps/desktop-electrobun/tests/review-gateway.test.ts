import { describe, expect, test } from "bun:test";
import { ReviewBridgeError, runEffectPromise } from "@shared/errors";
import { makeReviewGateway } from "../src/bun/review/service";

describe("review gateway service", () => {
  test("fails with REVIEW_BRIDGE_URL_MISSING when review Convex is not configured", async () => {
    const gateway = makeReviewGateway({
      resolveConvexUrl: () => undefined,
    });

    try {
      await runEffectPromise(
        gateway.sessionSnapshot({
          authToken: "token",
          reviewId: "review-123",
        }),
      );
      throw new Error("Expected review session snapshot to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewBridgeError);
      expect((error as ReviewBridgeError).code).toBe("REVIEW_BRIDGE_URL_MISSING");
    }
  });

  test("fails with REVIEW_AUTH_TOKEN_MISSING when auth token is blank", async () => {
    const gateway = makeReviewGateway({
      resolveConvexUrl: () => "https://example.convex.cloud",
    });

    try {
      await runEffectPromise(
        gateway.sessionSnapshot({
          authToken: "   ",
          reviewId: "review-123",
        }),
      );
      throw new Error("Expected review session snapshot to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewBridgeError);
      expect((error as ReviewBridgeError).code).toBe("REVIEW_AUTH_TOKEN_MISSING");
    }
  });

  test("normalizes request failures into REVIEW_REQUEST_FAILED", async () => {
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

    try {
      await runEffectPromise(
        gateway.sessionSnapshot({
          authToken: "token",
          reviewId: "review-123",
        }),
      );
      throw new Error("Expected review session snapshot to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewBridgeError);
      expect((error as ReviewBridgeError).code).toBe("REVIEW_REQUEST_FAILED");
    }
  });
});
