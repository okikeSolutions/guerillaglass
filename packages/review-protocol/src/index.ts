import { z } from "zod";

/** Canonical review workflow statuses used in Deliver review. */
export const reviewWorkflowStatusSchema = z.enum(["review", "rework", "done"]);

/** Team roles used for collaboration access and review attribution. */
export const reviewRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

/** Processing state for cloud review playback sources. */
export const reviewProcessingStateSchema = z.enum(["pending", "processing", "ready", "failed"]);

/** Preferred playback source when review media is loaded. */
export const reviewPlaybackSourceSchema = z.enum(["processed", "original"]);

/** Access policy for review share links. */
export const reviewSharePolicySchema = z.object({
  allowDownloads: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  passwordProtected: z.boolean(),
});

/** Presence signal for a watcher in an active review session. */
export const reviewPresenceSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  role: reviewRoleSchema,
  lastActiveAt: z.string().datetime(),
});

/** Frame/time-accurate review comment model. */
export const reviewCommentSchema = z.object({
  id: z.string().min(1),
  reviewId: z.string().min(1),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  body: z.string().min(1),
  frameNumber: z.number().int().nonnegative().nullable(),
  timestampSeconds: z.number().nonnegative().nullable(),
  resolved: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  parentCommentId: z.string().min(1).nullable(),
});

/** Full review-session snapshot payload consumed by the desktop Deliver route. */
export const reviewSessionSnapshotSchema = z.object({
  reviewId: z.string().min(1),
  status: reviewWorkflowStatusSchema,
  processingState: reviewProcessingStateSchema,
  preferredPlaybackSource: reviewPlaybackSourceSchema,
  sharePolicy: reviewSharePolicySchema,
  comments: z.array(reviewCommentSchema),
  presence: z.array(reviewPresenceSchema),
  updatedAt: z.string().datetime(),
});

/** Request payload for reading a review session snapshot. */
export const reviewSessionSnapshotRequestSchema = z.object({
  reviewId: z.string().min(1),
});

/** Request payload for creating a new review comment. */
export const reviewCreateCommentRequestSchema = z.object({
  reviewId: z.string().min(1),
  body: z.string().min(1),
  frameNumber: z.number().int().nonnegative().optional(),
  timestampSeconds: z.number().nonnegative().optional(),
  parentCommentId: z.string().min(1).optional(),
});

/** Request payload for updating review workflow status. */
export const reviewSetWorkflowStatusRequestSchema = z.object({
  reviewId: z.string().min(1),
  status: reviewWorkflowStatusSchema,
});

/** Response payload for workflow status updates. */
export const reviewSetWorkflowStatusResponseSchema = z.object({
  reviewId: z.string().min(1),
  status: reviewWorkflowStatusSchema,
  updatedAt: z.string().datetime(),
});

/** Event emitted when review presence changes for the active session. */
export const reviewPresenceUpdatedEventSchema = z.object({
  type: z.literal("presence.updated"),
  reviewId: z.string().min(1),
  presence: z.array(reviewPresenceSchema),
  emittedAt: z.string().datetime(),
});

/** Event emitted when a new comment is created in the active session. */
export const reviewCommentCreatedEventSchema = z.object({
  type: z.literal("comment.created"),
  reviewId: z.string().min(1),
  comment: reviewCommentSchema,
  emittedAt: z.string().datetime(),
});

/** Event emitted when review workflow status changes. */
export const reviewStatusChangedEventSchema = z.object({
  type: z.literal("workflow.statusChanged"),
  reviewId: z.string().min(1),
  status: reviewWorkflowStatusSchema,
  emittedAt: z.string().datetime(),
});

/** Event emitted when playback readiness changes in review delivery flows. */
export const reviewPlaybackStateChangedEventSchema = z.object({
  type: z.literal("playback.stateChanged"),
  reviewId: z.string().min(1),
  processingState: reviewProcessingStateSchema,
  preferredPlaybackSource: reviewPlaybackSourceSchema,
  emittedAt: z.string().datetime(),
});

/** Discriminated union for review bridge realtime events. */
export const reviewBridgeEventSchema = z.discriminatedUnion("type", [
  reviewPresenceUpdatedEventSchema,
  reviewCommentCreatedEventSchema,
  reviewStatusChangedEventSchema,
  reviewPlaybackStateChangedEventSchema,
]);

/** Type alias for ReviewWorkflowStatus. */
export type ReviewWorkflowStatus = z.infer<typeof reviewWorkflowStatusSchema>;
/** Type alias for ReviewRole. */
export type ReviewRole = z.infer<typeof reviewRoleSchema>;
/** Type alias for ReviewProcessingState. */
export type ReviewProcessingState = z.infer<typeof reviewProcessingStateSchema>;
/** Type alias for ReviewPlaybackSource. */
export type ReviewPlaybackSource = z.infer<typeof reviewPlaybackSourceSchema>;
/** Type alias for ReviewSharePolicy. */
export type ReviewSharePolicy = z.infer<typeof reviewSharePolicySchema>;
/** Type alias for ReviewPresence. */
export type ReviewPresence = z.infer<typeof reviewPresenceSchema>;
/** Type alias for ReviewComment. */
export type ReviewComment = z.infer<typeof reviewCommentSchema>;
/** Type alias for ReviewSessionSnapshot. */
export type ReviewSessionSnapshot = z.infer<typeof reviewSessionSnapshotSchema>;
/** Type alias for ReviewSessionSnapshotRequest. */
export type ReviewSessionSnapshotRequest = z.infer<typeof reviewSessionSnapshotRequestSchema>;
/** Type alias for ReviewCreateCommentRequest. */
export type ReviewCreateCommentRequest = z.infer<typeof reviewCreateCommentRequestSchema>;
/** Type alias for ReviewSetWorkflowStatusRequest. */
export type ReviewSetWorkflowStatusRequest = z.infer<typeof reviewSetWorkflowStatusRequestSchema>;
/** Type alias for ReviewSetWorkflowStatusResponse. */
export type ReviewSetWorkflowStatusResponse = z.infer<typeof reviewSetWorkflowStatusResponseSchema>;
/** Type alias for ReviewPresenceUpdatedEvent. */
export type ReviewPresenceUpdatedEvent = z.infer<typeof reviewPresenceUpdatedEventSchema>;
/** Type alias for ReviewCommentCreatedEvent. */
export type ReviewCommentCreatedEvent = z.infer<typeof reviewCommentCreatedEventSchema>;
/** Type alias for ReviewStatusChangedEvent. */
export type ReviewStatusChangedEvent = z.infer<typeof reviewStatusChangedEventSchema>;
/** Type alias for ReviewPlaybackStateChangedEvent. */
export type ReviewPlaybackStateChangedEvent = z.infer<typeof reviewPlaybackStateChangedEventSchema>;
/** Type alias for ReviewBridgeEvent. */
export type ReviewBridgeEvent = z.infer<typeof reviewBridgeEventSchema>;
