import { Effect } from "effect";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { isoDateTimeSchema } from "@guerillaglass/engine/protocol/schema-primitives";
import { createBunBridgeHandlers } from "../../shared/bridge";
import type { BunBridgeRequestHandlerMap, HostPathPickerMode } from "../../shared/bridge";
import { EngineTransport } from "@guerillaglass/engine/client/EngineTransport";
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
  const run = (effect: Effect.Effect<unknown, unknown, unknown>): Promise<any> =>
    runtime.runPromise(effect as Effect.Effect<unknown, unknown, HostRuntimeServices>);

  return createBunBridgeHandlers({
    ggEnginePing: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["system.ping"](undefined))),
    ggEngineGetPermissions: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["permissions.get"](undefined))),
    ggEngineAgentPreflight: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["agent.preflight"](params))),
    ggEngineAgentRun: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["agent.run"](params))),
    ggEngineAgentStatus: async ({ jobId }) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["agent.status"]({ jobId }))),
    ggEngineAgentApply: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["agent.apply"](params))),
    ggEngineRequestScreenRecordingPermission: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["permissions.requestScreenRecording"](undefined),
        ),
      ),
    ggEngineRequestMicrophonePermission: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["permissions.requestMicrophone"](undefined),
        ),
      ),
    ggEngineRequestInputMonitoringPermission: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["permissions.requestInputMonitoring"](undefined),
        ),
      ),
    ggEngineOpenInputMonitoringSettings: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["permissions.openInputMonitoringSettings"](undefined),
        ),
      ),
    ggEngineListSources: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["sources.list"](undefined))),
    ggEngineStartDisplayCapture: async ({ displayId, enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["capture.startDisplay"]({ displayId, enableMic, enablePreview, captureFps }),
        ),
      ),
    ggEngineStartCurrentWindowCapture: async ({ enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["capture.startCurrentWindow"]({ enableMic, enablePreview, captureFps }),
        ),
      ),
    ggEngineStartWindowCapture: async ({ windowId, enableMic, enablePreview, captureFps }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["capture.startWindow"]({ windowId, enableMic, enablePreview, captureFps }),
        ),
      ),
    ggEngineStopCapture: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["capture.stop"](undefined))),
    ggEngineStartRecording: async ({ trackInputEvents }) =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["recording.start"]({ trackInputEvents }),
        ),
      ),
    ggEngineStopRecording: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["recording.stop"](undefined))),
    ggEngineCaptureStatus: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["capture.status"](undefined))),
    ggEngineCapturePreviewFrame: async () =>
      run(
        Effect.flatMap(EngineTransport, (transport) =>
          transport["capture.previewFrame"](undefined),
        ),
      ),
    ggEngineExportInfo: async () =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["export.info"](undefined))),
    ggEngineRunExport: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["export.run"](params))),
    ggEngineRunCutPlanExport: async (params) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["export.runCutPlan"](params))),
    ggEngineProjectCurrent: async () => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport["project.current"](undefined)),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectOpen: async ({ projectPath }) => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport["project.open"]({ projectPath })),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectSave: async (params) => {
      const projectState = await run(
        Effect.flatMap(EngineTransport, (transport) => transport["project.save"](params)),
      );
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectRecents: async ({ limit }) =>
      run(Effect.flatMap(EngineTransport, (transport) => transport["project.recents"]({ limit }))),
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
        emittedAt: isoDateTimeSchema.make(new Date().toISOString()),
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
            run(
              Effect.flatMap(EngineTransport, (transport) =>
                transport["capture.previewFrame"](undefined),
              ),
            ),
          ),
        ),
      ),
  });
}
