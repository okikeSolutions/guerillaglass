/**
 * Typed contract for the Deliver review bridge.
 *
 * The protocol models the persisted review snapshot plus the realtime events that keep the
 * desktop Deliver route in sync with collaboration state, playback readiness, and comments.
 */
import { Schema } from "effect";
import { isoDateTimeSchema } from "@guerillaglass/schema-primitives";

/** Core review enums and shared entities used across snapshot, mutation, and event payloads. */
/** Canonical review workflow statuses used in Deliver review. */
export const reviewWorkflowStatusSchema = Schema.Union(
  Schema.Literal("review"),
  Schema.Literal("rework"),
  Schema.Literal("done"),
);

/** Team roles used for collaboration access and review attribution. */
export const reviewRoleSchema = Schema.Union(
  Schema.Literal("owner"),
  Schema.Literal("admin"),
  Schema.Literal("member"),
  Schema.Literal("viewer"),
);

/** Processing state for cloud review playback sources. */
export const reviewProcessingStateSchema = Schema.Union(
  Schema.Literal("pending"),
  Schema.Literal("processing"),
  Schema.Literal("ready"),
  Schema.Literal("failed"),
);

/** Preferred playback source when review media is loaded. */
export const reviewPlaybackSourceSchema = Schema.Union(
  Schema.Literal("processed"),
  Schema.Literal("original"),
);

/** Access policy for review share links. */
export const reviewSharePolicySchema = Schema.Struct({
  allowDownloads: Schema.Boolean,
  expiresAt: Schema.NullOr(isoDateTimeSchema),
  passwordProtected: Schema.Boolean,
});

/** Presence signal for a watcher in an active review session. */
export const reviewPresenceSchema = Schema.Struct({
  userId: Schema.NonEmptyString,
  displayName: Schema.NonEmptyString,
  role: reviewRoleSchema,
  lastActiveAt: isoDateTimeSchema,
});

/** Frame/time-accurate review comment model. */
export const reviewCommentSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  reviewId: Schema.NonEmptyString,
  authorId: Schema.NonEmptyString,
  authorName: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  frameNumber: Schema.NullOr(Schema.Int.pipe(Schema.greaterThanOrEqualTo(0))),
  timestampSeconds: Schema.NullOr(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  resolved: Schema.Boolean,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  parentCommentId: Schema.NullOr(Schema.NonEmptyString),
});

/** Full review-session snapshot payload consumed by the desktop Deliver route. */
export const reviewSessionSnapshotSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  status: reviewWorkflowStatusSchema,
  processingState: reviewProcessingStateSchema,
  preferredPlaybackSource: reviewPlaybackSourceSchema,
  sharePolicy: reviewSharePolicySchema,
  comments: Schema.Array(reviewCommentSchema),
  presence: Schema.Array(reviewPresenceSchema),
  updatedAt: isoDateTimeSchema,
});

/** Request and response payloads used by the review bridge command surface. */
/** Request payload for reading a review session snapshot. */
export const reviewSessionSnapshotRequestSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
});

/** Request payload for creating a new review comment. */
export const reviewCreateCommentRequestSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  frameNumber: Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(0))),
  timestampSeconds: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  parentCommentId: Schema.optional(Schema.NonEmptyString),
});

/** Request payload for updating review workflow status. */
export const reviewSetWorkflowStatusRequestSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  status: reviewWorkflowStatusSchema,
});

/** Response payload for workflow status updates. */
export const reviewSetWorkflowStatusResponseSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  status: reviewWorkflowStatusSchema,
  updatedAt: isoDateTimeSchema,
});

/** Realtime events emitted while a Deliver review session is active. */
/** Event emitted when review presence changes for the active session. */
export const reviewPresenceUpdatedEventSchema = Schema.Struct({
  type: Schema.Literal("presence.updated"),
  reviewId: Schema.NonEmptyString,
  presence: Schema.Array(reviewPresenceSchema),
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when a new comment is created in the active session. */
export const reviewCommentCreatedEventSchema = Schema.Struct({
  type: Schema.Literal("comment.created"),
  reviewId: Schema.NonEmptyString,
  comment: reviewCommentSchema,
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when review workflow status changes. */
export const reviewStatusChangedEventSchema = Schema.Struct({
  type: Schema.Literal("workflow.statusChanged"),
  reviewId: Schema.NonEmptyString,
  status: reviewWorkflowStatusSchema,
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when playback readiness changes in review delivery flows. */
export const reviewPlaybackStateChangedEventSchema = Schema.Struct({
  type: Schema.Literal("playback.stateChanged"),
  reviewId: Schema.NonEmptyString,
  processingState: reviewProcessingStateSchema,
  preferredPlaybackSource: reviewPlaybackSourceSchema,
  emittedAt: isoDateTimeSchema,
});

/**
 * Discriminated union for all realtime events emitted by the review bridge.
 *
 * Consumers should branch on `type` instead of probing payload shapes so newly-added event
 * payloads can extend the union without ambiguous runtime checks.
 */
export const reviewBridgeEventSchema = Schema.Union(
  reviewPresenceUpdatedEventSchema,
  reviewCommentCreatedEventSchema,
  reviewStatusChangedEventSchema,
  reviewPlaybackStateChangedEventSchema,
);

/** Inferred TypeScript aliases for consumers that only need the review data model. */
/** Type alias for ReviewWorkflowStatus. */
export type ReviewWorkflowStatus = typeof reviewWorkflowStatusSchema.Type;
/** Type alias for ReviewRole. */
export type ReviewRole = typeof reviewRoleSchema.Type;
/** Type alias for ReviewProcessingState. */
export type ReviewProcessingState = typeof reviewProcessingStateSchema.Type;
/** Type alias for ReviewPlaybackSource. */
export type ReviewPlaybackSource = typeof reviewPlaybackSourceSchema.Type;
/** Type alias for ReviewSharePolicy. */
export type ReviewSharePolicy = typeof reviewSharePolicySchema.Type;
/** Type alias for ReviewPresence. */
export type ReviewPresence = typeof reviewPresenceSchema.Type;
/** Type alias for ReviewComment. */
export type ReviewComment = typeof reviewCommentSchema.Type;
/** Type alias for ReviewSessionSnapshot. */
export type ReviewSessionSnapshot = typeof reviewSessionSnapshotSchema.Type;
/** Type alias for ReviewSessionSnapshotRequest. */
export type ReviewSessionSnapshotRequest = typeof reviewSessionSnapshotRequestSchema.Type;
/** Type alias for ReviewCreateCommentRequest. */
export type ReviewCreateCommentRequest = typeof reviewCreateCommentRequestSchema.Type;
/** Type alias for ReviewSetWorkflowStatusRequest. */
export type ReviewSetWorkflowStatusRequest = typeof reviewSetWorkflowStatusRequestSchema.Type;
/** Type alias for ReviewSetWorkflowStatusResponse. */
export type ReviewSetWorkflowStatusResponse = typeof reviewSetWorkflowStatusResponseSchema.Type;
/** Type alias for ReviewPresenceUpdatedEvent. */
export type ReviewPresenceUpdatedEvent = typeof reviewPresenceUpdatedEventSchema.Type;
/** Type alias for ReviewCommentCreatedEvent. */
export type ReviewCommentCreatedEvent = typeof reviewCommentCreatedEventSchema.Type;
/** Type alias for ReviewStatusChangedEvent. */
export type ReviewStatusChangedEvent = typeof reviewStatusChangedEventSchema.Type;
/** Type alias for ReviewPlaybackStateChangedEvent. */
export type ReviewPlaybackStateChangedEvent = typeof reviewPlaybackStateChangedEventSchema.Type;
/** Type alias for ReviewBridgeEvent. */
export type ReviewBridgeEvent = typeof reviewBridgeEventSchema.Type;
