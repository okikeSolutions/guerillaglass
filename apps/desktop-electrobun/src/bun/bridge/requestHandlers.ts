import { Effect } from "effect";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { createBunBridgeHandlers } from "../../shared/bridge";
import type { BunBridgeRequestHandlerMap, HostPathPickerMode } from "../../shared/bridge";
import { EngineTransport } from "../engine/service";
import { MediaSourceService } from "../media/service";
import { ReviewGateway } from "../review/service";
import type { HostRuntime, HostRuntimeServices } from "../runtime/hostRuntime";
import { resolveAllowedMediaFilePath } from "../security/fileAccess";

type BridgeHandlerDependencies = {
  runtime: HostRuntime;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  getCurrentProjectPath: () => string | null;
  setCurrentProjectPath: (projectPath: string | null) => void;
  emitReviewEvent: (event: ReviewBridgeEvent) => void;
};

/** Creates bridge RPC handlers backed by the scoped host runtime. */
export function createEngineBridgeHandlers({
  runtime,
  pickPath,
  readTextFile,
  getCurrentProjectPath,
  setCurrentProjectPath,
  emitReviewEvent,
}: BridgeHandlerDependencies): BunBridgeRequestHandlerMap {
  const run = <A, E, R extends HostRuntimeServices>(effect: Effect.Effect<A, E, R>) =>
    runtime.runPromise(effect);

  return createBunBridgeHandlers({
    ggEnginePing: async () => run(Effect.flatMap(EngineTransport, (transport) => transport.ping)),
    ggEngineGetPermissions: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.getPermissions)),
    ggEngineAgentPreflight: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.agentPreflight(params))),
    ggEngineAgentRun: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.agentRun(params))),
    ggEngineAgentStatus: async ({ jobId }) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.agentStatus(jobId))),
    ggEngineAgentApply: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.agentApply(params))),
    ggEngineRequestScreenRecordingPermission: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) => transport.requestScreenRecordingPermission),
      ),
    ggEngineRequestMicrophonePermission: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.requestMicrophonePermission)),
    ggEngineRequestInputMonitoringPermission: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) => transport.requestInputMonitoringPermission),
      ),
    ggEngineOpenInputMonitoringSettings: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.openInputMonitoringSettings)),
    ggEngineListSources: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.listSources)),
    ggEngineStartDisplayCapture: async ({ displayId, enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport.startDisplayCapture(enableMic, captureFps, displayId, enablePreview),
        ),
      ),
    ggEngineStartCurrentWindowCapture: async ({ enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport.startCurrentWindowCapture(enableMic, captureFps, enablePreview),
        ),
      ),
    ggEngineStartWindowCapture: async ({ windowId, enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport.startWindowCapture(windowId, enableMic, captureFps, enablePreview),
        ),
      ),
    ggEngineStopCapture: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.stopCapture)),
    ggEngineStartRecording: async ({ trackInputEvents }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) => transport.startRecording(trackInputEvents)),
      ),
    ggEngineStopRecording: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.stopRecording)),
    ggEngineCaptureStatus: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.captureStatus)),
    ggEngineCapturePreviewFrame: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.capturePreviewFrame)),
    ggEngineExportInfo: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.exportInfo)),
    ggEngineRunExport: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.runExport(params))),
    ggEngineRunCutPlanExport: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.runCutPlanExport(params))),
    ggEngineProjectCurrent: async () => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport.projectCurrent),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectOpen: async ({ projectPath }) => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport.projectOpen(projectPath)),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectSave: async (params) => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport.projectSave(params)),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectRecents: async ({ limit }) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport.projectRecents(limit))),
    ggReviewSessionSnapshot: async ({ authToken, reviewId }) =>
      run(
        Effect.flatMap(ReviewGateway, (reviewGateway) =>
          reviewGateway.sessionSnapshot({ authToken, reviewId }),
        ),
      ),
    ggReviewCreateComment: async (params) => {
      const comment = await run(
        Effect.flatMap(ReviewGateway, (reviewGateway) => reviewGateway.createComment(params)),
      );
      emitReviewEvent({
        type: "comment.created",
        reviewId: comment.reviewId,
        comment,
        emittedAt: new Date().toISOString(),
      });
      return comment;
    },
    ggReviewSetWorkflowStatus: async (params) => {
      const response = await run(
        Effect.flatMap(ReviewGateway, (reviewGateway) => reviewGateway.setWorkflowStatus(params)),
      );
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
        const allowedMediaPath = resolveAllowedMediaFilePath(filePath, {
          currentProjectPath: getCurrentProjectPath(),
          tempDirectory: process.env.TMPDIR,
        });
        return await run(
          Effect.flatMap(MediaSourceService, (mediaSourceService) =>
            mediaSourceService.resolveMediaSourceURL(allowedMediaPath),
          ),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`ggResolveMediaSourceURL failed for "${filePath}": ${reason}`);
        throw error;
      }
    },
    ggResolveCapturePreviewURL: async () =>
      run(
        Effect.flatMap(MediaSourceService, (mediaSourceService) =>
          mediaSourceService.resolveCapturePreviewURL(() =>
            run(Effect.flatMap(EngineTransport, (transport) => transport.capturePreviewFrame)),
          ),
        ),
      ),
  });
}
