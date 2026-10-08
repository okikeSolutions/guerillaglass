import { describe, expect, test } from "vitest";
import { Schema } from "effect";
import { reviewBridgeEventSchema, reviewSessionSnapshotSchema } from "../src";
import snapshotFixture from "../fixtures/review-session.snapshot.json" with { type: "json" };
import commentEventFixture from "../fixtures/review-bridge.comment-created.event.json" with { type: "json" };

describe("review protocol schemas", () => {
  test("decode the persisted snapshot and discriminated comment event", () => {
    const snapshot = Schema.decodeUnknownSync(reviewSessionSnapshotSchema)(snapshotFixture);
    const event = Schema.decodeUnknownSync(reviewBridgeEventSchema)(commentEventFixture);

    expect(snapshot.reviewId).toBe("review_5d4d3f1f");
    expect(snapshot.comments[0]?.frameNumber).toBe(420);
    expect(event.type).toBe("comment.created");
  });

  test("reject invalid timestamps and negative frame positions at the protocol boundary", () => {
    const invalidSnapshot = {
      ...snapshotFixture,
      updatedAt: "tomorrow",
    };
    const invalidEvent = {
      ...commentEventFixture,
      emittedAt: "not-a-date",
      comment: { ...commentEventFixture.comment, frameNumber: -1 },
    };

    expect(() => Schema.decodeUnknownSync(reviewSessionSnapshotSchema)(invalidSnapshot)).toThrow();
    expect(() => Schema.decodeUnknownSync(reviewBridgeEventSchema)(invalidEvent)).toThrow();
  });
});
