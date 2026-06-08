import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Context, Effect, Layer, Redacted } from "effect";
import type {
  ReviewComment,
  ReviewSessionSnapshot,
  ReviewSetWorkflowStatusResponse,
  ReviewWorkflowStatus,
} from "@guerillaglass/review-protocol";
import { messageFromUnknownError } from "@guerillaglass/engine/client/errors/clientErrors";
import { AppConfig } from "../app/AppConfig";
import { ReviewBridgeError } from "../../shared/errors/desktopErrors";

const reviewSessionSnapshotQuery = makeFunctionReference<
  "query",
  { reviewId: string },
  ReviewSessionSnapshot
>("review:sessionSnapshot");
const reviewCreateCommentMutation = makeFunctionReference<
  "mutation",
  {
    reviewId: string;
    body: string;
    frameNumber?: number;
    timestampSeconds?: number;
    parentCommentId?: string;
  },
  ReviewComment
>("review:createComment");
const reviewSetWorkflowStatusMutation = makeFunctionReference<
  "mutation",
  { reviewId: string; status: ReviewWorkflowStatus },
  ReviewSetWorkflowStatusResponse
>("review:setWorkflowStatus");

type ReviewClientLike = Pick<ConvexHttpClient, "query" | "mutation">;

type ReviewGatewayService = {
  sessionSnapshot: (params: {
    authToken: string;
    reviewId: string;
  }) => Effect.Effect<ReviewSessionSnapshot, ReviewBridgeError>;
  createComment: (params: {
    authToken: string;
    reviewId: string;
    body: string;
    frameNumber?: number;
    timestampSeconds?: number;
    parentCommentId?: string;
  }) => Effect.Effect<ReviewComment, ReviewBridgeError>;
  setWorkflowStatus: (params: {
    authToken: string;
    reviewId: string;
    status: ReviewWorkflowStatus;
  }) => Effect.Effect<ReviewSetWorkflowStatusResponse, ReviewBridgeError>;
};

type ReviewGatewayDependencies = {
  createClient?: (reviewConvexUrl: string, authToken: string) => ReviewClientLike;
  resolveConvexUrl?: () => string | undefined;
  fallbackReviewConvexUrl?: string | null;
};

/** Effect service tag for Convex-backed review operations used by the Bun host. */
export class ReviewGateway extends Context.Service<ReviewGateway, ReviewGatewayService>()(
  "@guerillaglass/desktop/ReviewGateway",
) {}

function resolveReviewConvexUrl(
  dependencies: ReviewGatewayDependencies,
): Effect.Effect<string, ReviewBridgeError> {
  return Effect.sync(
    () => dependencies.resolveConvexUrl?.() ?? dependencies.fallbackReviewConvexUrl,
  ).pipe(
    Effect.flatMap((reviewConvexUrl) => {
      if (reviewConvexUrl && reviewConvexUrl.trim().length > 0) {
        return Effect.succeed(reviewConvexUrl);
      }
      return Effect.fail(
        new ReviewBridgeError({
          code: "REVIEW_BRIDGE_URL_MISSING",
          description:
            "Missing GG_REVIEW_CONVEX_URL (or VITE_CONVEX_URL). Review bridge now requires Convex.",
        }),
      );
    }),
  );
}

function requireReviewAuthToken(authToken: string): Effect.Effect<string, ReviewBridgeError> {
  return Effect.sync(() => authToken.trim()).pipe(
    Effect.flatMap((normalizedToken) => {
      if (normalizedToken.length > 0) {
        return Effect.succeed(normalizedToken);
      }
      return Effect.fail(
        new ReviewBridgeError({
          code: "REVIEW_AUTH_TOKEN_MISSING",
          description: "Missing authToken. Review bridge requires a user-scoped Convex JWT.",
        }),
      );
    }),
  );
}

function defaultCreateClient(reviewConvexUrl: string, authToken: string): ReviewClientLike {
  const client = new ConvexHttpClient(reviewConvexUrl);
  client.setAuth(authToken);
  return client;
}

function reviewRequestEffect<A>(
  operation: string,
  authToken: string,
  dependencies: ReviewGatewayDependencies,
  run: (client: ReviewClientLike) => Promise<A>,
): Effect.Effect<A, ReviewBridgeError> {
  return Effect.gen(function* () {
    const normalizedToken = yield* requireReviewAuthToken(authToken).pipe(
      Effect.map((token) => Redacted.make(token, { label: "review-auth-token" })),
    );
    const reviewConvexUrl = yield* resolveReviewConvexUrl(dependencies);
    const client = (dependencies.createClient ?? defaultCreateClient)(
      reviewConvexUrl,
      Redacted.value(normalizedToken),
    );
    return yield* Effect.tryPromise({
      try: () => run(client),
      catch: (error) =>
        new ReviewBridgeError({
          code: "REVIEW_REQUEST_FAILED",
          description: messageFromUnknownError(error, `Review ${operation} failed.`),
          cause: error,
        }),
    });
  });
}

/** Creates the Effect review gateway from Convex client dependencies. */
export function makeReviewGateway(
  dependencies: ReviewGatewayDependencies = {},
): ReviewGatewayService {
  return {
    sessionSnapshot: ({ authToken, reviewId }) =>
      reviewRequestEffect("session snapshot", authToken, dependencies, (client) =>
        client.query(reviewSessionSnapshotQuery, { reviewId }),
      ),
    createComment: (params) =>
      reviewRequestEffect("create comment", params.authToken, dependencies, (client) =>
        client.mutation(reviewCreateCommentMutation, {
          reviewId: params.reviewId,
          body: params.body,
          frameNumber: params.frameNumber,
          timestampSeconds: params.timestampSeconds,
          parentCommentId: params.parentCommentId,
        }),
      ),
    setWorkflowStatus: ({ authToken, reviewId, status }) =>
      reviewRequestEffect("set workflow status", authToken, dependencies, (client) =>
        client.mutation(reviewSetWorkflowStatusMutation, {
          reviewId,
          status,
        }),
      ),
  };
}

/** Builds the review gateway layer with injectable Convex wiring for tests. */
export function makeLayerReviewGateway(dependencies?: ReviewGatewayDependencies) {
  if (dependencies?.resolveConvexUrl) {
    return Layer.succeed(ReviewGateway, makeReviewGateway(dependencies));
  }
  return Layer.effect(
    ReviewGateway,
    Effect.map(AppConfig, (config) =>
      makeReviewGateway({
        ...dependencies,
        fallbackReviewConvexUrl: dependencies?.fallbackReviewConvexUrl ?? config.reviewConvexUrl,
      }),
    ),
  );
}

/** Default review gateway layer used by the desktop app runtime. */
export const layerReviewGateway = makeLayerReviewGateway();
