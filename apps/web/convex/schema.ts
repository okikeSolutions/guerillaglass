import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const reviewWorkflowStatusValidator = v.union(
  v.literal("review"),
  v.literal("rework"),
  v.literal("done"),
);
const reviewProcessingStateValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
);
const reviewPlaybackSourceValidator = v.union(v.literal("processed"), v.literal("original"));
const reviewRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
);

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  reviewSessions: defineTable({
    reviewId: v.string(),
    ownerUserId: v.string(),
    ownerName: v.string(),
    ownerEmail: v.optional(v.union(v.string(), v.null())),
    status: reviewWorkflowStatusValidator,
    processingState: reviewProcessingStateValidator,
    preferredPlaybackSource: reviewPlaybackSourceValidator,
    sharePolicyAllowDownloads: v.boolean(),
    sharePolicyExpiresAt: v.union(v.string(), v.null()),
    sharePolicyPasswordProtected: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_review_id", ["reviewId"])
    .index("by_owner_user_id", ["ownerUserId"]),
  reviewComments: defineTable({
    reviewId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    body: v.string(),
    frameNumber: v.union(v.number(), v.null()),
    timestampSeconds: v.union(v.number(), v.null()),
    resolved: v.boolean(),
    parentCommentId: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_review_id_and_created_at", ["reviewId", "createdAt"]),
  reviewPresence: defineTable({
    reviewId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    role: reviewRoleValidator,
    lastActiveAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_review_id", ["reviewId"])
    .index("by_review_id_and_user_id", ["reviewId", "userId"]),
});
