import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import {
  ReviewComment,
  ReviewCommentId,
  ReviewId,
  ReviewSessionSnapshot,
  ReviewSetWorkflowStatusResponse,
  ReviewWorkflowStatus,
} from "@guerillaglass/review-protocol";
import type { ReviewAuthToken } from "@guerillaglass/engine-contract/schema-primitives";
import { messageFromUnknownError } from "@guerillaglass/engine-client/errors";
import { AppConfig } from "../app/AppConfig";
import { ReviewBridgeError } from "../../shared/errors/desktopErrors";

const reviewSessionSnapshotQuery = makeFunctionReference<
  "query",
  { reviewId: ReviewId },
  ReviewSessionSnapshot
>("review:sessionSnapshot");
const reviewCreateCommentMutation = makeFunctionReference<
  "mutation",
  {
    reviewId: ReviewId;
    body: string;
    frameNumber?: number;
    timestampSeconds?: number;
    parentCommentId?: ReviewCommentId;
  },
  ReviewComment
>("review:createComment");
const reviewSetWorkflowStatusMutation = makeFunctionReference<
  "mutation",
  { reviewId: ReviewId; status: ReviewWorkflowStatus },
  ReviewSetWorkflowStatusResponse
>("review:setWorkflowStatus");

type ReviewClientLike = Pick<ConvexHttpClient, "query" | "mutation">;

type ReviewGatewayService = {
  sessionSnapshot: (params: {
    authToken: ReviewAuthToken;
    reviewId: ReviewId;
  }) => Effect.Effect<ReviewSessionSnapshot, ReviewBridgeError>;
  createComment: (params: {
    authToken: ReviewAuthToken;
    reviewId: ReviewId;
    body: string;
    frameNumber?: number;
    timestampSeconds?: number;
    parentCommentId?: ReviewCommentId;
  }) => Effect.Effect<ReviewComment, ReviewBridgeError>;
  setWorkflowStatus: (params: {
    authToken: ReviewAuthToken;
    reviewId: ReviewId;
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

const resolveReviewConvexUrl = Effect.fn("service.resolveReviewConvexUrl")(function (
  dependencies: ReviewGatewayDependencies,
): Effect.Effect<string, ReviewBridgeError> {
  return Effect.sync(
    () => dependencies.resolveConvexUrl?.() ?? dependencies.fallbackReviewConvexUrl,
  ).pipe(
    Effect.filterOrFail(
      (reviewConvexUrl): reviewConvexUrl is string =>
        typeof reviewConvexUrl === "string" && reviewConvexUrl.trim().length > 0,
      () =>
        new ReviewBridgeError({
          code: "REVIEW_BRIDGE_URL_MISSING",
          description:
            "Missing GG_REVIEW_CONVEX_URL (or VITE_CONVEX_URL). Review bridge now requires Convex.",
        }),
    ),
  );
});

const requireReviewAuthToken = Effect.fn("service.requireReviewAuthToken")(function (
  authToken: string,
): Effect.Effect<string, ReviewBridgeError> {
  return Effect.sync(() => authToken.trim()).pipe(
    Effect.filterOrFail(
      (normalizedToken) => normalizedToken.length > 0,
      () =>
        new ReviewBridgeError({
          code: "REVIEW_AUTH_TOKEN_MISSING",
          description: "Missing authToken. Review bridge requires a user-scoped Convex JWT.",
        }),
    ),
  );
});

function defaultCreateClient(reviewConvexUrl: string, authToken: string): ReviewClientLike {
  const client = new ConvexHttpClient(reviewConvexUrl);
  client.setAuth(authToken);
  return client;
}

const reviewRequestEffect = Effect.fn("ReviewGateway.request")(<
  S extends Schema.ConstraintCodec<unknown, unknown>,
>(
  operation: string,
  authToken: string,
  dependencies: ReviewGatewayDependencies,
  schema: S,
  run: (client: ReviewClientLike) => Promise<unknown>,
): Effect.Effect<S["Type"], ReviewBridgeError> => {
  return Effect.gen(function* () {
    const normalizedToken = yield* requireReviewAuthToken(authToken).pipe(
      Effect.map((token) => Redacted.make(token, { label: "review-auth-token" })),
    );
    const reviewConvexUrl = yield* resolveReviewConvexUrl(dependencies);
    const client = yield* Effect.try({
      try: () =>
        (dependencies.createClient ?? defaultCreateClient)(
          reviewConvexUrl,
          Redacted.value(normalizedToken),
        ),
      catch: (cause) =>
        new ReviewBridgeError({
          code: "REVIEW_REQUEST_FAILED",
          description: "Unable to initialize the review client.",
          cause,
        }),
    });
    const response = yield* Effect.tryPromise({
      try: () => run(client),
      catch: (error) =>
        new ReviewBridgeError({
          code: "REVIEW_REQUEST_FAILED",
          description: messageFromUnknownError(error, `Review ${operation} failed.`),
          cause: error,
        }),
    });
    return yield* Schema.decodeUnknownEffect(schema)(response).pipe(
      Effect.mapError(
        (cause) =>
          new ReviewBridgeError({
            code: "REVIEW_REQUEST_FAILED",
            description: `Invalid review ${operation} response.`,
            cause,
          }),
      ),
    );
  });
});

/** Creates the Effect review gateway from Convex client dependencies. */
export function makeReviewGateway(
  dependencies: ReviewGatewayDependencies = {},
): ReviewGatewayService {
  return ReviewGateway.of({
    sessionSnapshot: Effect.fn("ReviewGateway.sessionSnapshot")(
      ({ authToken, reviewId }: Parameters<ReviewGatewayService["sessionSnapshot"]>[0]) =>
        reviewRequestEffect(
          "session snapshot",
          authToken,
          dependencies,
          ReviewSessionSnapshot,
          (client) => client.query(reviewSessionSnapshotQuery, { reviewId }),
        ),
    ),
    createComment: Effect.fn("ReviewGateway.createComment")(
      (params: Parameters<ReviewGatewayService["createComment"]>[0]) =>
        reviewRequestEffect(
          "create comment",
          params.authToken,
          dependencies,
          ReviewComment,
          (client) =>
            client.mutation(reviewCreateCommentMutation, {
              reviewId: params.reviewId,
              body: params.body,
              frameNumber: params.frameNumber,
              timestampSeconds: params.timestampSeconds,
              parentCommentId: params.parentCommentId,
            }),
        ),
    ),
    setWorkflowStatus: Effect.fn("ReviewGateway.setWorkflowStatus")(
      ({ authToken, reviewId, status }: Parameters<ReviewGatewayService["setWorkflowStatus"]>[0]) =>
        reviewRequestEffect(
          "set workflow status",
          authToken,
          dependencies,
          ReviewSetWorkflowStatusResponse,
          (client) =>
            client.mutation(reviewSetWorkflowStatusMutation, {
              reviewId,
              status,
            }),
        ),
    ),
  });
}

/** Builds the review gateway layer with injectable Convex wiring for tests. */
export function makeLayerReviewGateway(dependencies?: ReviewGatewayDependencies) {
  if (dependencies?.resolveConvexUrl) {
    return Layer.sync(ReviewGateway, () => makeReviewGateway(dependencies));
  }
  return Layer.effect(
    ReviewGateway,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      return makeReviewGateway({
        ...dependencies,
        fallbackReviewConvexUrl: dependencies?.fallbackReviewConvexUrl ?? config.reviewConvexUrl,
      });
    }),
  );
}

/** Default review gateway layer used by the desktop app runtime. */
export const layerReviewGateway = makeLayerReviewGateway();
