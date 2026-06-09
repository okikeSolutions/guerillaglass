import { Context, Effect, Layer, Option, Schema } from "effect";
import { isoDateTimeSchema } from "@guerillaglass/engine-contract/schema-primitives";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { capturePreviewFrameResultSchema } from "@guerillaglass/engine-contract/domains/capture";
import { AgentService } from "@guerillaglass/engine-client/services/AgentService";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import { ExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { RecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService } from "@guerillaglass/engine-client/services/SystemService";
import { MediaSourceService } from "../media/service";
import { ProjectSession } from "../session/ProjectSession";
import { ReviewGateway } from "../review/service";
import { DesktopShell } from "../shell/DesktopShell";
import { BridgeRequestLimits } from "../security/BridgeRequestLimits";
import { FileAccessGrants } from "../security/FileAccessGrants";
import { ProjectExportPathPolicy } from "../security/ProjectExportPathPolicy";
import { CapabilityGrantService } from "../security/DesktopCapabilities";
import type { BridgeRequestName, BridgeRequests } from "../../shared/bridge/desktopBridgeContract";
import { CapabilityTokenError } from "../../shared/errors/desktopErrors";

type HostBridgeServiceShape = {
  handle<K extends BridgeRequestName>(
    name: K,
    params: BridgeRequests[K]["params"],
  ): Effect.Effect<BridgeRequests[K]["response"], unknown>;
};

export class HostBridgeService extends Context.Service<HostBridgeService, HostBridgeServiceShape>()(
  "@guerillaglass/desktop/HostBridgeService",
) {}

function reviewEventCreated(comment: any): ReviewBridgeEvent {
  return {
    type: "comment.created",
    reviewId: comment.reviewId,
    comment,
    emittedAt: isoDateTimeSchema.make(new Date().toISOString()),
  };
}

function reviewMutationSubject(reviewId: string): string {
  return `review:${reviewId}`;
}

function mediaSourceSubject(filePath: string): string {
  return `media:${filePath}`;
}

function capturePreviewSubject(captureSessionId: string): string {
  return `capture:${captureSessionId}`;
}

function captureSessionIdFromStatus(status: any): string | null {
  const value = status?.captureSessionId;
  if (typeof value === "string") return value;
  if (Option.isOption(value)) return Option.getOrNull(value) as string | null;
  return null;
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
      const requestEffect = Effect.gen(function* () {
        switch (name) {
          case "ggEnginePing": {
            const system = yield* SystemService;
            return yield* system.ping;
          }
          case "ggEngineGetPermissions": {
            const permissions = yield* PermissionsService;
            return yield* permissions.get;
          }
          case "ggEngineAgentPreflight": {
            const agent = yield* AgentService;
            return yield* agent.preflight(params as any);
          }
          case "ggEngineAgentRun": {
            const agent = yield* AgentService;
            return yield* agent.run(params as any);
          }
          case "ggEngineAgentStatus": {
            const agent = yield* AgentService;
            return yield* agent.status((params as { jobId: string }).jobId);
          }
          case "ggEngineAgentApply": {
            const agent = yield* AgentService;
            return yield* agent.apply((params as { jobId: string }).jobId, params as any);
          }
          case "ggEngineRequestScreenRecordingPermission": {
            const permissions = yield* PermissionsService;
            return yield* permissions.requestScreenRecording;
          }
          case "ggEngineRequestMicrophonePermission": {
            const permissions = yield* PermissionsService;
            return yield* permissions.requestMicrophone;
          }
          case "ggEngineRequestInputMonitoringPermission": {
            const permissions = yield* PermissionsService;
            return yield* permissions.requestInputMonitoring;
          }
          case "ggEngineOpenInputMonitoringSettings": {
            const permissions = yield* PermissionsService;
            return yield* permissions.openInputMonitoringSettings;
          }
          case "ggEngineListSources": {
            const sources = yield* SourcesService;
            return yield* sources.list;
          }
          case "ggEngineStartDisplayCapture": {
            const capture = yield* CaptureService;
            return yield* capture.startDisplay(params as any);
          }
          case "ggEngineStartCurrentWindowCapture": {
            const capture = yield* CaptureService;
            return yield* capture.startCurrentWindow(params as any);
          }
          case "ggEngineStartWindowCapture": {
            const capture = yield* CaptureService;
            return yield* capture.startWindow(params as any);
          }
          case "ggEngineStopCapture": {
            const capture = yield* CaptureService;
            return yield* capture.stop;
          }
          case "ggEngineStartRecording": {
            const recording = yield* RecordingService;
            return yield* recording.start(params as any);
          }
          case "ggEngineStopRecording": {
            const recording = yield* RecordingService;
            return yield* recording.stop;
          }
          case "ggEngineCaptureStatus": {
            const capture = yield* CaptureService;
            return yield* capture.status;
          }
          case "ggEngineCapturePreviewFrame": {
            const capture = yield* CaptureService;
            return yield* capture.previewFrame;
          }
          case "ggEngineExportInfo": {
            const exportService = yield* ExportService;
            return yield* exportService.info;
          }
          case "ggEngineRunExport": {
            const pathPolicy = yield* ProjectExportPathPolicy;
            const outputURL = yield* pathPolicy.validateExportOutputPath(
              (params as { outputURL: string }).outputURL,
            );
            const exportService = yield* ExportService;
            return yield* exportService.run({ ...(params as any), outputURL } as any);
          }
          case "ggEngineRunCutPlanExport": {
            const pathPolicy = yield* ProjectExportPathPolicy;
            const outputURL = yield* pathPolicy.validateExportOutputPath(
              (params as { outputURL: string }).outputURL,
            );
            const exportService = yield* ExportService;
            return yield* exportService.runCutPlan({ ...(params as any), outputURL } as any);
          }
          case "ggEngineProjectCurrent": {
            const session = yield* ProjectSession;
            return yield* session.projectCurrent;
          }
          case "ggEngineProjectOpen": {
            const session = yield* ProjectSession;
            const pathPolicy = yield* ProjectExportPathPolicy;
            const projectPath = yield* pathPolicy.validateProjectOpenPath(
              (params as { projectPath: string }).projectPath,
            );
            return yield* session.projectOpen({ ...(params as any), projectPath } as any);
          }
          case "ggEngineProjectSave": {
            const session = yield* ProjectSession;
            const pathPolicy = yield* ProjectExportPathPolicy;
            const projectPath = (params as { projectPath?: string }).projectPath;
            if (projectPath) {
              const validatedProjectPath = yield* pathPolicy.validateProjectSavePath(projectPath);
              return yield* session.projectSave({
                ...(params as any),
                projectPath: validatedProjectPath,
              } as any);
            }
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
          case "ggGrantReviewMutationCapability": {
            const capabilities = yield* CapabilityGrantService;
            const authToken = (params as { authToken: string }).authToken.trim();
            if (!authToken) {
              return yield* new CapabilityTokenError({
                code: "CAPABILITY_TOKEN_INVALID",
                description: "Missing authToken for review mutation capability.",
              });
            }
            return yield* capabilities.mint({
              scope: "review:mutate",
              subject: reviewMutationSubject((params as { reviewId: string }).reviewId),
              singleUse: true,
            });
          }
          case "ggReviewCreateComment": {
            const reviewGateway = yield* ReviewGateway;
            const shell = yield* DesktopShell;
            const capabilities = yield* CapabilityGrantService;
            const reviewId = (params as { reviewId: string }).reviewId;
            yield* capabilities.consume({
              token: (params as { capabilityToken: string }).capabilityToken,
              scope: "review:mutate",
              subject: reviewMutationSubject(reviewId),
            });
            const comment = yield* reviewGateway.createComment(params as any);
            yield* shell.publishReviewEvent(reviewEventCreated(comment));
            return comment;
          }
          case "ggReviewSetWorkflowStatus": {
            const reviewGateway = yield* ReviewGateway;
            const shell = yield* DesktopShell;
            const capabilities = yield* CapabilityGrantService;
            const reviewId = (params as { reviewId: string }).reviewId;
            yield* capabilities.consume({
              token: (params as { capabilityToken: string }).capabilityToken,
              scope: "review:mutate",
              subject: reviewMutationSubject(reviewId),
            });
            const response = yield* reviewGateway.setWorkflowStatus(params as any);
            yield* shell.publishReviewEvent(reviewWorkflowChanged(response));
            return response;
          }
          case "ggPickPath": {
            const session = yield* ProjectSession;
            const grants = yield* FileAccessGrants;
            const pickedPath = yield* session.pickPath(params as any);
            if (pickedPath) {
              yield* grants.grantPickedPath((params as { mode: any }).mode, pickedPath);
            }
            return pickedPath;
          }
          case "ggReadTextFile": {
            const session = yield* ProjectSession;
            return yield* session.readTextFile((params as { filePath: string }).filePath);
          }
          case "ggGrantMediaSourceCapability": {
            const session = yield* ProjectSession;
            const capabilities = yield* CapabilityGrantService;
            const filePath = (params as { filePath: string }).filePath;
            const allowedMediaPath = yield* session.resolveAllowedMediaFilePath(filePath);
            return yield* capabilities.mint({
              scope: "media:resolve-source",
              subject: mediaSourceSubject(allowedMediaPath),
              singleUse: true,
            });
          }
          case "ggResolveMediaSourceURL": {
            const session = yield* ProjectSession;
            const mediaSourceService = yield* MediaSourceService;
            const capabilities = yield* CapabilityGrantService;
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
            yield* capabilities.consume({
              token: (params as { capabilityToken: string }).capabilityToken,
              scope: "media:resolve-source",
              subject: mediaSourceSubject(allowedMediaPath),
            });
            return yield* mediaSourceService.resolveMediaSourceURL(allowedMediaPath);
          }
          case "ggGrantCapturePreviewCapability": {
            const capture = yield* CaptureService;
            const capabilities = yield* CapabilityGrantService;
            const captureSessionId = (params as { captureSessionId: string }).captureSessionId;
            const status = yield* capture.status;
            if (!status.isRunning || captureSessionIdFromStatus(status) !== captureSessionId) {
              return yield* new CapabilityTokenError({
                code: "CAPABILITY_TOKEN_INVALID",
                description: "Capture preview capability requires the active capture session.",
              });
            }
            return yield* capabilities.mint({
              scope: "capture:resolve-preview-url",
              subject: capturePreviewSubject(captureSessionId),
              singleUse: true,
            });
          }
          case "ggResolveCapturePreviewURL": {
            const capture = yield* CaptureService;
            const mediaSourceService = yield* MediaSourceService;
            const capabilities = yield* CapabilityGrantService;
            const captureSessionId = (params as { captureSessionId: string }).captureSessionId;
            yield* capabilities.consume({
              token: (params as { capabilityToken: string }).capabilityToken,
              scope: "capture:resolve-preview-url",
              subject: capturePreviewSubject(captureSessionId),
            });
            const encodePreviewFrame = Schema.encodeUnknownEffect(
              Schema.toCodecJson(capturePreviewFrameResultSchema),
            );
            return yield* mediaSourceService.resolveCapturePreviewURL(
              capture.previewFrame.pipe(
                Effect.flatMap(encodePreviewFrame),
                Effect.map((frame) => frame as any),
              ),
            );
          }
        }
      }) as Effect.Effect<BridgeRequests[typeof name]["response"], unknown>;

      return Effect.flatMap(BridgeRequestLimits, (limits) =>
        limits.guard(name, requestEffect),
      ) as Effect.Effect<BridgeRequests[typeof name]["response"], unknown>;
    },
  }),
);
