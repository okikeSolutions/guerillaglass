import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import {
  reviewBridgeEventSchema,
  reviewSessionSnapshotSchema,
} from "@guerillaglass/review-protocol";

function decodeSchemaSync<S extends Schema.Schema.Any>(
  schema: S,
  raw: unknown,
): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(raw) as Schema.Schema.Type<S>;
}

describe("review protocol", () => {
  test("parses review fixtures with ISO datetime fields", () => {
    const fixtureDir = path.resolve(import.meta.dir, "../../../packages/review-protocol/fixtures");
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, "review-session.snapshot.json"), "utf8"),
    );
    const commentCreatedEvent = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, "review-bridge.comment-created.event.json"), "utf8"),
    );

    expect(decodeSchemaSync(reviewSessionSnapshotSchema, snapshot).reviewId).toBe(
      "review_5d4d3f1f",
    );
    expect(decodeSchemaSync(reviewBridgeEventSchema, commentCreatedEvent).type).toBe(
      "comment.created",
    );
  });

  test("rejects invalid ISO datetime fields in review payloads", () => {
    const invalidSnapshot = {
      reviewId: "review-123",
      status: "review",
      processingState: "ready",
      preferredPlaybackSource: "processed",
      sharePolicy: {
        allowDownloads: true,
        expiresAt: "tomorrow",
        passwordProtected: false,
      },
      comments: [],
      presence: [],
      updatedAt: "2026-03-02T09:21:00.000Z",
    };
    const invalidEvent = {
      type: "workflow.statusChanged",
      reviewId: "review-123",
      status: "done",
      emittedAt: "2026-13-02T09:21:00.000Z",
    };

    expect(() => decodeSchemaSync(reviewSessionSnapshotSchema, invalidSnapshot)).toThrow();
    expect(() => decodeSchemaSync(reviewBridgeEventSchema, invalidEvent)).toThrow();
  });
});
