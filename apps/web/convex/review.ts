import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

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
type ReviewRole = "owner" | "admin" | "member" | "viewer";
const REVIEW_COMMENT_MAX_BODY_LENGTH = 4000;
const REVIEW_COMMENT_MIN_INTERVAL_MS = 500;
const REVIEW_SESSION_CREATE_MIN_INTERVAL_MS = 2000;

const reviewCommentValidator = v.object({
  id: v.string(),
  reviewId: v.string(),
  authorId: v.string(),
  authorName: v.string(),
  body: v.string(),
  frameNumber: v.union(v.number(), v.null()),
  timestampSeconds: v.union(v.number(), v.null()),
  resolved: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  parentCommentId: v.union(v.string(), v.null()),
});
const reviewSessionSnapshotValidator = v.object({
  reviewId: v.string(),
  status: reviewWorkflowStatusValidator,
  processingState: reviewProcessingStateValidator,
  preferredPlaybackSource: reviewPlaybackSourceValidator,
  sharePolicy: v.object({
    allowDownloads: v.boolean(),
    expiresAt: v.union(v.string(), v.null()),
    passwordProtected: v.boolean(),
  }),
  comments: v.array(reviewCommentValidator),
  presence: v.array(
    v.object({
      userId: v.string(),
      displayName: v.string(),
      role: reviewRoleValidator,
      lastActiveAt: v.string(),
    }),
  ),
  updatedAt: v.string(),
});
const reviewSetWorkflowStatusResponseValidator = v.object({
  reviewId: v.string(),
  status: reviewWorkflowStatusValidator,
  updatedAt: v.string(),
});

type ReviewSessionDoc = Doc<"reviewSessions">;
type ReviewCommentDoc = Doc<"reviewComments">;
type ReviewMemberDoc = Doc<"reviewMembers">;
type ReviewPresenceDoc = Doc<"reviewPresence">;

type AuthActor = {
  id: string;
  displayName: string;
};

function nowTimestampMs(): number {
  return Date.now();
}

function toIsoTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function roleAllowed(role: ReviewRole, allowedRoles: ReadonlySet<ReviewRole>): boolean {
  return allowedRoles.has(role);
}

function resolveDisplayName(user: { name?: unknown; email?: unknown }): string {
  const preferredName = normalizeOptionalString(user.name);
  if (preferredName) {
    return preferredName;
  }
  const email = normalizeOptionalString(user.email);
  if (email) {
    return email;
  }
  return "Member";
}

async function requireAuthActor(ctx: QueryCtx | MutationCtx): Promise<AuthActor> {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) {
    throw new ConvexError("Unauthenticated");
  }

  return {
    id: String(user._id),
    displayName: resolveDisplayName(user),
  };
}

function mapCommentDocument(comment: ReviewCommentDoc): {
  id: string;
  reviewId: string;
  authorId: string;
  authorName: string;
  body: string;
  frameNumber: number | null;
  timestampSeconds: number | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  parentCommentId: string | null;
} {
  return {
    id: String(comment._id),
    reviewId: comment.reviewId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    frameNumber: comment.frameNumber,
    timestampSeconds: comment.timestampSeconds,
    resolved: comment.resolved,
    createdAt: toIsoTimestamp(comment.createdAt),
    updatedAt: toIsoTimestamp(comment.updatedAt),
    parentCommentId: comment.parentCommentId,
  };
}

function mapPresenceDocument(presence: ReviewPresenceDoc): {
  userId: string;
  displayName: string;
  role: "owner" | "admin" | "member" | "viewer";
  lastActiveAt: string;
} {
  return {
    userId: presence.userId,
    displayName: presence.displayName,
    role: presence.role,
    lastActiveAt: toIsoTimestamp(presence.lastActiveAt),
  };
}

function mapSnapshot(
  session: ReviewSessionDoc,
  comments: ReviewCommentDoc[],
  presence: ReviewPresenceDoc[],
): {
  reviewId: string;
  status: "review" | "rework" | "done";
  processingState: "pending" | "processing" | "ready" | "failed";
  preferredPlaybackSource: "processed" | "original";
  sharePolicy: {
    allowDownloads: boolean;
    expiresAt: string | null;
    passwordProtected: boolean;
  };
  comments: {
    id: string;
    reviewId: string;
    authorId: string;
    authorName: string;
    body: string;
    frameNumber: number | null;
    timestampSeconds: number | null;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    parentCommentId: string | null;
  }[];
  presence: {
    userId: string;
    displayName: string;
    role: "owner" | "admin" | "member" | "viewer";
    lastActiveAt: string;
  }[];
  updatedAt: string;
} {
  return {
    reviewId: session.reviewId,
    status: session.status,
    processingState: session.processingState,
    preferredPlaybackSource: session.preferredPlaybackSource,
    sharePolicy: {
      allowDownloads: session.sharePolicyAllowDownloads,
      expiresAt: session.sharePolicyExpiresAt,
      passwordProtected: session.sharePolicyPasswordProtected,
    },
    comments: comments.map((comment) => mapCommentDocument(comment)),
    presence: presence.map((entry) => mapPresenceDocument(entry)),
    updatedAt: toIsoTimestamp(session.updatedAt),
  };
}

function buildDefaultSnapshot(reviewId: string): {
  reviewId: string;
  status: "review";
  processingState: "pending";
  preferredPlaybackSource: "original";
  sharePolicy: {
    allowDownloads: boolean;
    expiresAt: null;
    passwordProtected: boolean;
  };
  comments: [];
  presence: [];
  updatedAt: string;
} {
  return {
    reviewId,
    status: "review",
    processingState: "pending",
    preferredPlaybackSource: "original",
    sharePolicy: {
      allowDownloads: false,
      expiresAt: null,
      passwordProtected: false,
    },
    comments: [],
    presence: [],
    updatedAt: toIsoTimestamp(nowTimestampMs()),
  };
}

async function getReviewSession(
  ctx: QueryCtx | MutationCtx,
  reviewId: string,
): Promise<ReviewSessionDoc | null> {
  return await ctx.db
    .query("reviewSessions")
    .withIndex("by_review_id", (q) => q.eq("reviewId", reviewId))
    .unique();
}

function generateReviewId(): string {
  return `review_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function createUniqueReviewId(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateReviewId = generateReviewId();
    const existing = await getReviewSession(ctx, candidateReviewId);
    if (!existing) {
      return candidateReviewId;
    }
  }
  throw new ConvexError("REVIEW_SESSION_CREATE_FAILED");
}

async function createOwnedReviewSession(
  ctx: MutationCtx,
  actor: AuthActor,
): Promise<ReviewSessionDoc> {
  const now = nowTimestampMs();
  const lastOwnedSession = await ctx.db
    .query("reviewSessions")
    .withIndex("by_owner_user_id_and_created_at", (q) => q.eq("ownerUserId", actor.id))
    .order("desc")
    .first();
  if (
    lastOwnedSession &&
    now - lastOwnedSession.createdAt < REVIEW_SESSION_CREATE_MIN_INTERVAL_MS
  ) {
    throw new ConvexError("REVIEW_SESSION_RATE_LIMITED");
  }

  const reviewId = await createUniqueReviewId(ctx);
  const sessionId = await ctx.db.insert("reviewSessions", {
    reviewId,
    ownerUserId: actor.id,
    ownerName: actor.displayName,
    ownerEmail: null,
    status: "review",
    processingState: "pending",
    preferredPlaybackSource: "original",
    sharePolicyAllowDownloads: false,
    sharePolicyExpiresAt: null,
    sharePolicyPasswordProtected: false,
    statusUpdatedByUserId: actor.id,
    statusUpdatedByName: actor.displayName,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("reviewMembers", {
    reviewId,
    userId: actor.id,
    displayName: actor.displayName,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(sessionId);
  if (!created) {
    throw new ConvexError("REVIEW_SESSION_CREATE_FAILED");
  }
  return created;
}

async function getReviewMembership(
  ctx: QueryCtx | MutationCtx,
  reviewId: string,
  userId: string,
): Promise<ReviewMemberDoc | null> {
  return await ctx.db
    .query("reviewMembers")
    .withIndex("by_review_id_and_user_id", (q) => q.eq("reviewId", reviewId).eq("userId", userId))
    .unique();
}

async function resolveReviewRole(
  ctx: QueryCtx | MutationCtx,
  session: ReviewSessionDoc,
  actor: AuthActor,
): Promise<ReviewRole | null> {
  if (session.ownerUserId === actor.id) {
    return "owner";
  }

  const membership = await getReviewMembership(ctx, session.reviewId, actor.id);
  if (!membership) {
    return null;
  }
  return membership.role;
}

async function requireReviewRoleOrNotFound(
  ctx: QueryCtx | MutationCtx,
  session: ReviewSessionDoc,
  actor: AuthActor,
  allowedRoles: ReadonlySet<ReviewRole>,
): Promise<ReviewRole> {
  const role = await resolveReviewRole(ctx, session, actor);
  if (!role || !roleAllowed(role, allowedRoles)) {
    throw new ConvexError("REVIEW_NOT_FOUND");
  }
  return role;
}

async function requireReviewSession(ctx: MutationCtx, reviewId: string): Promise<ReviewSessionDoc> {
  const session = await getReviewSession(ctx, reviewId);
  if (!session) {
    throw new ConvexError("REVIEW_NOT_FOUND");
  }
  return session;
}

async function enforceCommentWriteLimit(
  ctx: MutationCtx,
  reviewId: string,
  actorId: string,
  now: number,
): Promise<void> {
  const lastComment = await ctx.db
    .query("reviewComments")
    .withIndex("by_review_id_and_author_id_and_created_at", (q) =>
      q.eq("reviewId", reviewId).eq("authorId", actorId),
    )
    .order("desc")
    .first();
  if (lastComment && now - lastComment.createdAt < REVIEW_COMMENT_MIN_INTERVAL_MS) {
    throw new ConvexError("REVIEW_COMMENT_RATE_LIMITED");
  }
}

const readReviewRoles = new Set<ReviewRole>(["owner", "admin", "member", "viewer"]);
const commentReviewRoles = new Set<ReviewRole>(["owner", "admin", "member", "viewer"]);
const workflowStatusReviewRoles = new Set<ReviewRole>(["owner", "admin", "member"]);

export const createSession = mutation({
  args: {},
  returns: reviewSessionSnapshotValidator,
  handler: async (ctx) => {
    const actor = await requireAuthActor(ctx);
    const session = await createOwnedReviewSession(ctx, actor);
    return mapSnapshot(session, [], []);
  },
});

export const sessionSnapshot = query({
  args: {
    reviewId: v.string(),
  },
  returns: reviewSessionSnapshotValidator,
  handler: async (ctx, args) => {
    const actor = await requireAuthActor(ctx);

    const session = await getReviewSession(ctx, args.reviewId);
    if (!session) {
      return buildDefaultSnapshot(args.reviewId);
    }
    const role = await resolveReviewRole(ctx, session, actor);
    if (!role || !roleAllowed(role, readReviewRoles)) {
      return buildDefaultSnapshot(args.reviewId);
    }

    const comments = await ctx.db
      .query("reviewComments")
      .withIndex("by_review_id_and_created_at", (q) => q.eq("reviewId", args.reviewId))
      .collect();
    const presence = await ctx.db
      .query("reviewPresence")
      .withIndex("by_review_id", (q) => q.eq("reviewId", args.reviewId))
      .collect();

    return mapSnapshot(session, comments, presence);
  },
});

export const createComment = mutation({
  args: {
    reviewId: v.string(),
    body: v.string(),
    frameNumber: v.optional(v.number()),
    timestampSeconds: v.optional(v.number()),
    parentCommentId: v.optional(v.string()),
  },
  returns: reviewCommentValidator,
  handler: async (ctx, args) => {
    const actor = await requireAuthActor(ctx);
    const body = args.body.trim();
    if (body.length === 0) {
      throw new ConvexError("REVIEW_COMMENT_BODY_REQUIRED");
    }
    if (body.length > REVIEW_COMMENT_MAX_BODY_LENGTH) {
      throw new ConvexError("REVIEW_COMMENT_BODY_TOO_LONG");
    }

    const session = await requireReviewSession(ctx, args.reviewId);
    await requireReviewRoleOrNotFound(ctx, session, actor, commentReviewRoles);
    const now = nowTimestampMs();
    await enforceCommentWriteLimit(ctx, session.reviewId, actor.id, now);
    const commentId = await ctx.db.insert("reviewComments", {
      reviewId: session.reviewId,
      authorId: actor.id,
      authorName: actor.displayName,
      body,
      frameNumber: args.frameNumber ?? null,
      timestampSeconds: args.timestampSeconds ?? null,
      resolved: false,
      parentCommentId: args.parentCommentId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(session._id, {
      updatedAt: now,
    });

    const createdComment = await ctx.db.get(commentId);
    if (!createdComment) {
      throw new ConvexError("REVIEW_COMMENT_CREATE_FAILED");
    }

    return mapCommentDocument(createdComment);
  },
});

export const setWorkflowStatus = mutation({
  args: {
    reviewId: v.string(),
    status: reviewWorkflowStatusValidator,
  },
  returns: reviewSetWorkflowStatusResponseValidator,
  handler: async (ctx, args) => {
    const actor = await requireAuthActor(ctx);
    const session = await requireReviewSession(ctx, args.reviewId);
    await requireReviewRoleOrNotFound(ctx, session, actor, workflowStatusReviewRoles);
    const updatedAt = nowTimestampMs();

    await ctx.db.patch(session._id, {
      status: args.status,
      statusUpdatedByUserId: actor.id,
      statusUpdatedByName: actor.displayName,
      updatedAt,
    });

    return {
      reviewId: session.reviewId,
      status: args.status,
      updatedAt: toIsoTimestamp(updatedAt),
    };
  },
});
