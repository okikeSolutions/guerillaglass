import { Context, Effect, Layer, Schema } from "effect";
import { isoDateTimeSchema } from "@guerillaglass/engine/protocol/schema-primitives";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { capturePreviewFrameResultSchema } from "@guerillaglass/engine/protocol/domains/capture";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { MediaSourceService } from "../media/service";
import { ProjectSession } from "../session/ProjectSession";
import { ReviewGateway } from "../review/service";
import { DesktopShell } from "../shell/DesktopShell";
import type { BridgeRequestName, BridgeRequests } from "../../shared/bridge/desktopBridgeContract";

type HostBridgeServiceShape = {
  handle<K extends BridgeRequestName>(
    name: K,
    params: BridgeRequests[K]["params"],
  ): Effect.Effect<BridgeRequests[K]["response"], unknown>;
};

export class HostBridgeService extends Context.Service<HostBridgeService, HostBridgeServiceShape>()(
  "@guerillaglass/desktop/HostBridgeService",
) {}

const engine = <A, E>(
  f: (transport: any) => Effect.Effect<A, E>,
): Effect.Effect<A, E, EngineTransport> =>
  Effect.gen(function* () {
    const transport = yield* EngineTransport;
    return yield* f(transport);
  });

function reviewEventCreated(comment: any): ReviewBridgeEvent {
  return {
    type: "comment.created",
    reviewId: comment.reviewId,
    comment,
    emittedAt: isoDateTimeSchema.make(new Date().toISOString()),
  };
}

function reviewWorkflowChanged(response: any): ReviewBridgeEvent {
  return {
    type: "workflow.statusChanged",
    reviewId: response.reviewId,
    status: response.status,
    emittedAt: response.updatedAt,
  };
}

export const layerHostBridgeService = Layer.succeed(
  HostBridgeService,
  HostBridgeService.of({
    handle(name, params) {
      return Effect.gen(function* () {
        switch (name) {
          case "ggEnginePing":
            return yield* engine((transport) => transport["system.ping"](undefined));
          case "ggEngineGetPermissions":
            return yield* engine((transport) => transport["permissions.get"](undefined));
          case "ggEngineAgentPreflight":
            return yield* engine((transport) => transport["agent.preflight"](params as any));
          case "ggEngineAgentRun":
            return yield* engine((transport) => transport["agent.run"](params as any));
          case "ggEngineAgentStatus":
            return yield* engine((transport) => transport["agent.status"](params as any));
          case "ggEngineAgentApply":
            return yield* engine((transport) => transport["agent.apply"](params as any));
          case "ggEngineRequestScreenRecordingPermission":
            return yield* engine((transport) =>
              transport["permissions.requestScreenRecording"](undefined),
            );
          case "ggEngineRequestMicrophonePermission":
            return yield* engine((transport) =>
              transport["permissions.requestMicrophone"](undefined),
            );
          case "ggEngineRequestInputMonitoringPermission":
            return yield* engine((transport) =>
              transport["permissions.requestInputMonitoring"](undefined),
            );
          case "ggEngineOpenInputMonitoringSettings":
            return yield* engine((transport) =>
              transport["permissions.openInputMonitoringSettings"](undefined),
            );
          case "ggEngineListSources":
            return yield* engine((transport) => transport["sources.list"](undefined));
          case "ggEngineStartDisplayCapture":
            return yield* engine((transport) => transport["capture.startDisplay"](params as any));
          case "ggEngineStartCurrentWindowCapture":
            return yield* engine((transport) =>
              transport["capture.startCurrentWindow"](params as any),
            );
          case "ggEngineStartWindowCapture":
            return yield* engine((transport) => transport["capture.startWindow"](params as any));
          case "ggEngineStopCapture":
            return yield* engine((transport) => transport["capture.stop"](undefined));
          case "ggEngineStartRecording":
            return yield* engine((transport) => transport["recording.start"](params as any));
          case "ggEngineStopRecording":
            return yield* engine((transport) => transport["recording.stop"](undefined));
          case "ggEngineCaptureStatus":
            return yield* engine((transport) => transport["capture.status"](undefined));
          case "ggEngineCapturePreviewFrame":
            return yield* engine((transport) => transport["capture.previewFrame"](undefined));
          case "ggEngineExportInfo":
            return yield* engine((transport) => transport["export.info"](undefined));
          case "ggEngineRunExport":
            return yield* engine((transport) => transport["export.run"](params as any));
          case "ggEngineRunCutPlanExport":
            return yield* engine((transport) => transport["export.runCutPlan"](params as any));
          case "ggEngineProjectCurrent": {
            const session = yield* ProjectSession;
            return yield* session.projectCurrent;
          }
          case "ggEngineProjectOpen": {
            const session = yield* ProjectSession;
            return yield* session.projectOpen(params as any);
          }
          case "ggEngineProjectSave": {
            const session = yield* ProjectSession;
            return yield* session.projectSave(params as any);
          }
          case "ggEngineProjectRecents": {
            const session = yield* ProjectSession;
            return yield* session.projectRecents(params as any);
          }
          case "ggReviewSessionSnapshot": {
            const reviewGateway = yield* ReviewGateway;
            return yield* reviewGateway.sessionSnapshot(params as any);
          }
          case "ggReviewCreateComment": {
            const reviewGateway = yield* ReviewGateway;
            const shell = yield* DesktopShell;
            const comment = yield* reviewGateway.createComment(params as any);
            yield* shell.publishReviewEvent(reviewEventCreated(comment));
            return comment;
          }
          case "ggReviewSetWorkflowStatus": {
            const reviewGateway = yield* ReviewGateway;
            const shell = yield* DesktopShell;
            const response = yield* reviewGateway.setWorkflowStatus(params as any);
            yield* shell.publishReviewEvent(reviewWorkflowChanged(response));
            return response;
          }
          case "ggPickPath": {
            const session = yield* ProjectSession;
            return yield* session.pickPath(params as any);
          }
          case "ggReadTextFile": {
            const session = yield* ProjectSession;
            return yield* session.readTextFile((params as { filePath: string }).filePath);
          }
          case "ggResolveMediaSourceURL": {
            const session = yield* ProjectSession;
            const mediaSourceService = yield* MediaSourceService;
            const filePath = (params as { filePath: string }).filePath;
            const allowedMediaPath = yield* session.resolveAllowedMediaFilePath(filePath).pipe(
              Effect.catch((error) =>
                Effect.gen(function* () {
                  const reason = error instanceof Error ? error.message : String(error);
                  yield* Effect.logWarning(
                    `ggResolveMediaSourceURL failed for "${filePath}": ${reason}`,
                  );
                  return yield* Effect.fail(error);
                }),
              ),
            );
            return yield* mediaSourceService.resolveMediaSourceURL(allowedMediaPath);
          }
          case "ggResolveCapturePreviewURL": {
            const transport = yield* EngineTransport;
            const mediaSourceService = yield* MediaSourceService;
            const encodePreviewFrame = Schema.encodeUnknownEffect(
              Schema.toCodecJson(capturePreviewFrameResultSchema),
            );
            return yield* mediaSourceService.resolveCapturePreviewURL(
              transport["capture.previewFrame"](undefined).pipe(
                Effect.flatMap(encodePreviewFrame),
                Effect.map((frame) => frame as any),
              ),
            );
          }
        }
      }) as Effect.Effect<BridgeRequests[typeof name]["response"], unknown>;
    },
  }),
);
