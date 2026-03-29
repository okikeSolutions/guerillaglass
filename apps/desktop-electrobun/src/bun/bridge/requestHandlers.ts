import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type {
  ReviewBridgeEvent,
  ReviewComment,
  ReviewSessionSnapshot,
  ReviewSetWorkflowStatusResponse,
  ReviewWorkflowStatus,
} from "@guerillaglass/review-protocol";
import { createBunBridgeHandlers } from "@shared/bridge";
import type { BunBridgeRequestHandlerMap, HostPathPickerMode } from "@shared/bridge";
import type { EngineClient } from "../engine/client";

type BridgeHandlerDependencies = {
  engineClient: EngineClient;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  resolveMediaSourceURL: (filePath: string) => Promise<string>;
  setCurrentProjectPath: (projectPath: string | null) => void;
  emitReviewEvent: (event: ReviewBridgeEvent) => void;
};

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

type ReviewGateway = {
  sessionSnapshot: (params: {
    authToken: string;
    reviewId: string;
  }) => Promise<ReviewSessionSnapshot>;
  createComment: (params: {
    authToken: string;
    reviewId: string;
    body: string;
    frameNumber?: number;
    timestampSeconds?: number;
    parentCommentId?: string;
  }) => Promise<ReviewComment>;
  setWorkflowStatus: (params: {
    authToken: string;
    reviewId: string;
    status: ReviewWorkflowStatus;
  }) => Promise<ReviewSetWorkflowStatusResponse>;
};

function resolveReviewConvexUrl(): string {
  const reviewConvexUrl = process.env.GG_REVIEW_CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!reviewConvexUrl) {
    throw new Error(
      "Missing GG_REVIEW_CONVEX_URL (or VITE_CONVEX_URL). Review bridge now requires Convex.",
    );
  }
  return reviewConvexUrl;
}

function requireReviewAuthToken(authToken: string): string {
  const normalizedToken = authToken.trim();
  if (!normalizedToken) {
    throw new Error("Missing authToken. Review bridge requires a user-scoped Convex JWT.");
  }
  return normalizedToken;
}

function createReviewGateway(): ReviewGateway {
  return {
    sessionSnapshot: async ({ authToken, reviewId }) => {
      const client = new ConvexHttpClient(resolveReviewConvexUrl());
      client.setAuth(requireReviewAuthToken(authToken));
      return await client.query(reviewSessionSnapshotQuery, {
        reviewId,
      });
    },
    createComment: async (params) => {
      const client = new ConvexHttpClient(resolveReviewConvexUrl());
      client.setAuth(requireReviewAuthToken(params.authToken));
      return await client.mutation(reviewCreateCommentMutation, {
        reviewId: params.reviewId,
        body: params.body,
        frameNumber: params.frameNumber,
        timestampSeconds: params.timestampSeconds,
        parentCommentId: params.parentCommentId,
      });
    },
    setWorkflowStatus: async ({ authToken, reviewId, status }) => {
      const client = new ConvexHttpClient(resolveReviewConvexUrl());
      client.setAuth(requireReviewAuthToken(authToken));
      return await client.mutation(reviewSetWorkflowStatusMutation, {
        reviewId,
        status,
      });
    },
  };
}

/** Creates bridge RPC handlers backed by the desktop engine client. */
export function createEngineBridgeHandlers({
  engineClient,
  pickPath,
  readTextFile,
  resolveMediaSourceURL,
  setCurrentProjectPath,
  emitReviewEvent,
}: BridgeHandlerDependencies): BunBridgeRequestHandlerMap {
  const reviewGateway = createReviewGateway();

  return createBunBridgeHandlers({
    ggEnginePing: async () => engineClient.ping(),
    ggEngineGetPermissions: async () => engineClient.getPermissions(),
    ggEngineAgentPreflight: async (params) => engineClient.agentPreflight(params),
    ggEngineAgentRun: async (params) => engineClient.agentRun(params),
    ggEngineAgentStatus: async ({ jobId }) => engineClient.agentStatus(jobId),
    ggEngineAgentApply: async (params) => engineClient.agentApply(params),
    ggEngineRequestScreenRecordingPermission: async () =>
      engineClient.requestScreenRecordingPermission(),
    ggEngineRequestMicrophonePermission: async () => engineClient.requestMicrophonePermission(),
    ggEngineRequestInputMonitoringPermission: async () =>
      engineClient.requestInputMonitoringPermission(),
    ggEngineOpenInputMonitoringSettings: async () => engineClient.openInputMonitoringSettings(),
    ggEngineListSources: async () => engineClient.listSources(),
    ggEngineStartDisplayCapture: async ({ enableMic, captureFps }) =>
      engineClient.startDisplayCapture(enableMic, captureFps),
    ggEngineStartCurrentWindowCapture: async ({ enableMic, captureFps }) =>
      engineClient.startCurrentWindowCapture(enableMic, captureFps),
    ggEngineStartWindowCapture: async ({ windowId, enableMic, captureFps }) =>
      engineClient.startWindowCapture(windowId, enableMic, captureFps),
    ggEngineStopCapture: async () => engineClient.stopCapture(),
    ggEngineStartRecording: async ({ trackInputEvents }) =>
      engineClient.startRecording(trackInputEvents),
    ggEngineStopRecording: async () => engineClient.stopRecording(),
    ggEngineCaptureStatus: async () => engineClient.captureStatus(),
    ggEngineExportInfo: async () => engineClient.exportInfo(),
    ggEngineRunExport: async (params) => engineClient.runExport(params),
    ggEngineRunCutPlanExport: async (params) => engineClient.runCutPlanExport(params),
    ggEngineProjectCurrent: async () => {
      const projectState = await engineClient.projectCurrent();
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectOpen: async ({ projectPath }) => {
      const projectState = await engineClient.projectOpen(projectPath);
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectSave: async (params) => {
      const projectState = await engineClient.projectSave(params);
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectRecents: async ({ limit }) => engineClient.projectRecents(limit),
    ggReviewSessionSnapshot: async ({ authToken, reviewId }) =>
      reviewGateway.sessionSnapshot({ authToken, reviewId }),
    ggReviewCreateComment: async (params) => {
      const comment = await reviewGateway.createComment(params);
      emitReviewEvent({
        type: "comment.created",
        reviewId: comment.reviewId,
        comment,
        emittedAt: new Date().toISOString(),
      });
      return comment;
    },
    ggReviewSetWorkflowStatus: async (params) => {
      const response = await reviewGateway.setWorkflowStatus(params);
      emitReviewEvent({
        type: "workflow.statusChanged",
        reviewId: response.reviewId,
        status: response.status,
        emittedAt: response.updatedAt,
      });
      return response;
    },
    ggPickPath: async ({ mode, startingFolder }) => pickPath({ mode, startingFolder }),
    ggReadTextFile: async ({ filePath }) => readTextFile(filePath),
    ggResolveMediaSourceURL: async ({ filePath }) => {
      try {
        return await resolveMediaSourceURL(filePath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`ggResolveMediaSourceURL failed for "${filePath}": ${reason}`);
        throw error;
      }
    },
  });
}
