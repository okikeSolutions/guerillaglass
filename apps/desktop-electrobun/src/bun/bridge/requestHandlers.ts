import type { BridgeRequestHandlerMap, HostPathPickerMode } from "../../shared/bridgeRpc";
import { createBunBridgeHandlers } from "../../shared/bridgeBindings";
import type { EngineClient } from "../engine/client";
import type {
  ReviewComment,
  ReviewSessionSnapshot,
  ReviewWorkflowStatus,
} from "@guerillaglass/review-protocol";

type BridgeHandlerDependencies = {
  engineClient: EngineClient;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  resolveMediaSourceURL: (filePath: string) => Promise<string>;
  setCurrentProjectPath: (projectPath: string | null) => void;
};

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function buildDefaultReviewSession(reviewId: string): ReviewSessionSnapshot {
  const updatedAt = currentIsoTimestamp();
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
    updatedAt,
  };
}

/** Creates bridge RPC handlers backed by the desktop engine client. */
export function createEngineBridgeHandlers({
  engineClient,
  pickPath,
  readTextFile,
  resolveMediaSourceURL,
  setCurrentProjectPath,
}: BridgeHandlerDependencies): BridgeRequestHandlerMap {
  const reviewSessions = new Map<string, ReviewSessionSnapshot>();
  let commentSequence = 0;

  const getReviewSession = (reviewId: string): ReviewSessionSnapshot => {
    const existing = reviewSessions.get(reviewId);
    if (existing) {
      return existing;
    }
    const seeded = buildDefaultReviewSession(reviewId);
    reviewSessions.set(reviewId, seeded);
    return seeded;
  };

  const persistReviewSession = (session: ReviewSessionSnapshot): ReviewSessionSnapshot => {
    reviewSessions.set(session.reviewId, session);
    return session;
  };

  const createReviewComment = (
    session: ReviewSessionSnapshot,
    params: {
      body: string;
      frameNumber?: number;
      timestampSeconds?: number;
      parentCommentId?: string;
    },
  ): ReviewComment => {
    commentSequence += 1;
    const now = currentIsoTimestamp();
    const comment: ReviewComment = {
      id: `comment_${commentSequence.toString().padStart(4, "0")}`,
      reviewId: session.reviewId,
      authorId: "local_user",
      authorName: "Local User",
      body: params.body,
      frameNumber: params.frameNumber ?? null,
      timestampSeconds: params.timestampSeconds ?? null,
      resolved: false,
      createdAt: now,
      updatedAt: now,
      parentCommentId: params.parentCommentId ?? null,
    };
    return comment;
  };

  const updateReviewStatus = (
    session: ReviewSessionSnapshot,
    status: ReviewWorkflowStatus,
  ): ReviewSessionSnapshot => {
    const updatedAt = currentIsoTimestamp();
    return {
      ...session,
      status,
      updatedAt,
    };
  };

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
    ggReviewSessionSnapshot: async ({ reviewId }) => getReviewSession(reviewId),
    ggReviewCreateComment: async ({ reviewId, ...params }) => {
      const session = getReviewSession(reviewId);
      const comment = createReviewComment(session, params);
      const updatedSession: ReviewSessionSnapshot = {
        ...session,
        comments: [...session.comments, comment],
        updatedAt: comment.updatedAt,
      };
      persistReviewSession(updatedSession);
      return comment;
    },
    ggReviewSetWorkflowStatus: async ({ reviewId, status }) => {
      const session = getReviewSession(reviewId);
      const updatedSession = updateReviewStatus(session, status);
      persistReviewSession(updatedSession);
      return {
        reviewId,
        status: updatedSession.status,
        updatedAt: updatedSession.updatedAt,
      };
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
