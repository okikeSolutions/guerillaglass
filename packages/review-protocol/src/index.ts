/**
 * Typed contract for the Deliver review bridge.
 *
 * The protocol models the persisted review snapshot plus the realtime events that keep the
 * desktop Deliver route in sync with collaboration state, playback readiness, and comments.
 */
import { Schema } from "effect";

function greaterThanOrEqualTo(minimum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isGreaterThanOrEqualTo(minimum));
}
/** Unicode flag keeps the timestamp check in generated JSON Schema. */
export const isoDateTimeSchema = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T/u)).pipe(
  Schema.brand("IsoDateTime"),
);
export const reviewCommentIdSchema = Schema.NonEmptyString.pipe(Schema.brand("ReviewCommentId"));
export const reviewIdSchema = Schema.NonEmptyString.pipe(Schema.brand("ReviewId"));
export const reviewUserIdSchema = Schema.NonEmptyString.pipe(Schema.brand("ReviewUserId"));

/** Core review enums and shared entities used across snapshot, mutation, and event payloads. */
/** Canonical review workflow statuses used in Deliver review. */
export const reviewWorkflowStatusSchema = Schema.Union([
  Schema.Literal("review"),
  Schema.Literal("rework"),
  Schema.Literal("done"),
]);

/** Team roles used for collaboration access and review attribution. */
export const reviewRoleSchema = Schema.Union([
  Schema.Literal("owner"),
  Schema.Literal("admin"),
  Schema.Literal("member"),
  Schema.Literal("viewer"),
]);

/** Processing state for cloud review playback sources. */
export const reviewProcessingStateSchema = Schema.Union([
  Schema.Literal("pending"),
  Schema.Literal("processing"),
  Schema.Literal("ready"),
  Schema.Literal("failed"),
]);

/** Preferred playback source when review media is loaded. */
export const reviewPlaybackSourceSchema = Schema.Union([
  Schema.Literal("processed"),
  Schema.Literal("original"),
]);

/** Access policy for review share links. */
export const reviewSharePolicySchema = Schema.Struct({
  allowDownloads: Schema.Boolean,
  expiresAt: Schema.NullOr(isoDateTimeSchema),
  passwordProtected: Schema.Boolean,
});

/** Presence signal for a watcher in an active review session. */
export const reviewPresenceSchema = Schema.Struct({
  userId: reviewUserIdSchema,
  displayName: Schema.NonEmptyString,
  role: reviewRoleSchema,
  lastActiveAt: isoDateTimeSchema,
});

/** Frame/time-accurate review comment model. */
export const reviewCommentSchema = Schema.Struct({
  id: reviewCommentIdSchema,
  reviewId: reviewIdSchema,
  authorId: reviewUserIdSchema,
  authorName: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  frameNumber: Schema.NullOr(Schema.Int.pipe(greaterThanOrEqualTo(0))),
  timestampSeconds: Schema.NullOr(Schema.Finite.pipe(greaterThanOrEqualTo(0))),
  resolved: Schema.Boolean,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  parentCommentId: Schema.NullOr(reviewCommentIdSchema),
});

/** Full review-session snapshot payload consumed by the desktop Deliver route. */
export const reviewSessionSnapshotSchema = Schema.Struct({
  reviewId: reviewIdSchema,
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
  reviewId: reviewIdSchema,
});

/** Request payload for creating a new review comment. */
export const reviewCreateCommentRequestSchema = Schema.Struct({
  reviewId: reviewIdSchema,
  body: Schema.NonEmptyString,
  frameNumber: Schema.optional(Schema.Int.pipe(greaterThanOrEqualTo(0))),
  timestampSeconds: Schema.optional(Schema.Finite.pipe(greaterThanOrEqualTo(0))),
  parentCommentId: Schema.optional(reviewCommentIdSchema),
});

/** Request payload for updating review workflow status. */
export const reviewSetWorkflowStatusRequestSchema = Schema.Struct({
  reviewId: reviewIdSchema,
  status: reviewWorkflowStatusSchema,
});

/** Response payload for workflow status updates. */
export const reviewSetWorkflowStatusResponseSchema = Schema.Struct({
  reviewId: reviewIdSchema,
  status: reviewWorkflowStatusSchema,
  updatedAt: isoDateTimeSchema,
});

/** Realtime events emitted while a Deliver review session is active. */
/** Event emitted when review presence changes for the active session. */
export const reviewPresenceUpdatedEventSchema = Schema.Struct({
  type: Schema.Literal("presence.updated"),
  reviewId: reviewIdSchema,
  presence: Schema.Array(reviewPresenceSchema),
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when a new comment is created in the active session. */
export const reviewCommentCreatedEventSchema = Schema.Struct({
  type: Schema.Literal("comment.created"),
  reviewId: reviewIdSchema,
  comment: reviewCommentSchema,
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when review workflow status changes. */
export const reviewStatusChangedEventSchema = Schema.Struct({
  type: Schema.Literal("workflow.statusChanged"),
  reviewId: reviewIdSchema,
  status: reviewWorkflowStatusSchema,
  emittedAt: isoDateTimeSchema,
});

/** Event emitted when playback readiness changes in review delivery flows. */
export const reviewPlaybackStateChangedEventSchema = Schema.Struct({
  type: Schema.Literal("playback.stateChanged"),
  reviewId: reviewIdSchema,
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
export const reviewBridgeEventSchema = Schema.Union([
  reviewPresenceUpdatedEventSchema,
  reviewCommentCreatedEventSchema,
  reviewStatusChangedEventSchema,
  reviewPlaybackStateChangedEventSchema,
]);

/** Inferred TypeScript aliases for consumers that only need the review data model. */
/** Branded hosted review identifier. */
export type ReviewId = typeof reviewIdSchema.Type;
/** Branded hosted review comment identifier. */
export type ReviewCommentId = typeof reviewCommentIdSchema.Type;
/** Branded hosted review user identifier. */
export type ReviewUserId = typeof reviewUserIdSchema.Type;
/** Branded ISO-8601 timestamp. */
export type IsoDateTime = typeof isoDateTimeSchema.Type;
/** Type alias for ReviewWorkflowStatus. */
export type ReviewWorkflowStatus = typeof reviewWorkflowStatusSchema.Type;
/** Type alias for ReviewRole. */
export type ReviewRole = typeof reviewRoleSchema.Type;
/** Type alias for ReviewProcessingState. */
export type ReviewProcessingState = typeof reviewProcessingStateSchema.Type;
/** Type alias for ReviewPlaybackSource. */
export type ReviewPlaybackSource = typeof reviewPlaybackSourceSchema.Type;
/** Type alias for ReviewSharePolicy. */
export const ReviewSharePolicy = reviewSharePolicySchema;
/** Validated ReviewSharePolicy record. */
export interface ReviewSharePolicy extends Schema.Schema.Type<typeof ReviewSharePolicy> {}
/** Type alias for ReviewPresence. */
export const ReviewPresence = reviewPresenceSchema;
/** Validated ReviewPresence record. */
export interface ReviewPresence extends Schema.Schema.Type<typeof ReviewPresence> {}
/** Type alias for ReviewComment. */
export const ReviewComment = reviewCommentSchema;
/** Validated ReviewComment record. */
export interface ReviewComment extends Schema.Schema.Type<typeof ReviewComment> {}
/** Type alias for ReviewSessionSnapshot. */
export const ReviewSessionSnapshot = reviewSessionSnapshotSchema;
/** Validated ReviewSessionSnapshot record. */
export interface ReviewSessionSnapshot extends Schema.Schema.Type<typeof ReviewSessionSnapshot> {}
/** Type alias for ReviewSessionSnapshotRequest. */
export const ReviewSessionSnapshotRequest = reviewSessionSnapshotRequestSchema;
/** Validated ReviewSessionSnapshotRequest record. */
export interface ReviewSessionSnapshotRequest extends Schema.Schema.Type<
  typeof ReviewSessionSnapshotRequest
> {}
/** Type alias for ReviewCreateCommentRequest. */
export const ReviewCreateCommentRequest = reviewCreateCommentRequestSchema;
/** Validated ReviewCreateCommentRequest record. */
export interface ReviewCreateCommentRequest extends Schema.Schema.Type<
  typeof ReviewCreateCommentRequest
> {}
/** Type alias for ReviewSetWorkflowStatusRequest. */
export const ReviewSetWorkflowStatusRequest = reviewSetWorkflowStatusRequestSchema;
/** Validated ReviewSetWorkflowStatusRequest record. */
export interface ReviewSetWorkflowStatusRequest extends Schema.Schema.Type<
  typeof ReviewSetWorkflowStatusRequest
> {}
/** Type alias for ReviewSetWorkflowStatusResponse. */
export const ReviewSetWorkflowStatusResponse = reviewSetWorkflowStatusResponseSchema;
/** Validated ReviewSetWorkflowStatusResponse record. */
export interface ReviewSetWorkflowStatusResponse extends Schema.Schema.Type<
  typeof ReviewSetWorkflowStatusResponse
> {}
/** Type alias for ReviewPresenceUpdatedEvent. */
export const ReviewPresenceUpdatedEvent = reviewPresenceUpdatedEventSchema;
/** Validated ReviewPresenceUpdatedEvent record. */
export interface ReviewPresenceUpdatedEvent extends Schema.Schema.Type<
  typeof ReviewPresenceUpdatedEvent
> {}
/** Type alias for ReviewCommentCreatedEvent. */
export const ReviewCommentCreatedEvent = reviewCommentCreatedEventSchema;
/** Validated ReviewCommentCreatedEvent record. */
export interface ReviewCommentCreatedEvent extends Schema.Schema.Type<
  typeof ReviewCommentCreatedEvent
> {}
/** Type alias for ReviewStatusChangedEvent. */
export const ReviewStatusChangedEvent = reviewStatusChangedEventSchema;
/** Validated ReviewStatusChangedEvent record. */
export interface ReviewStatusChangedEvent extends Schema.Schema.Type<
  typeof ReviewStatusChangedEvent
> {}
/** Type alias for ReviewPlaybackStateChangedEvent. */
export const ReviewPlaybackStateChangedEvent = reviewPlaybackStateChangedEventSchema;
/** Validated ReviewPlaybackStateChangedEvent record. */
export interface ReviewPlaybackStateChangedEvent extends Schema.Schema.Type<
  typeof ReviewPlaybackStateChangedEvent
> {}
/** Type alias for ReviewBridgeEvent. */
export type ReviewBridgeEvent = typeof reviewBridgeEventSchema.Type;
