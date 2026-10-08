import { Context, Effect, Layer, Schema, type Config } from "effect";
import {
  isoDateTimeSchema,
  outputUrlSchema,
  projectPathSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import {
  type CapturePreviewFrameResult,
  type CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { AgentService } from "@guerillaglass/engine-client/services/AgentService";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import { ExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { RecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService } from "@guerillaglass/engine-client/services/SystemService";
import { MediaSourceService } from "../media/service";
import { ProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import { ProjectSession } from "../session/ProjectSession";
import { ReviewGateway } from "../review/service";
import { DesktopShell } from "../shell/DesktopShell";
import { BridgeRequestLimits } from "../security/BridgeRequestLimits";
import { FileAccessGrants } from "../security/FileAccessGrants";
import { ProjectExportPathPolicy } from "../security/ProjectExportPathPolicy";
import { CapabilityGrantService } from "../security/DesktopCapabilities";
import {
  bridgeDefinitionsByName,
  type BridgeRequestName,
  type BridgeRequests,
} from "../../shared/bridge/desktopBridgeContract";
import type { EngineClientFailure } from "@guerillaglass/engine-client/errors";
import {
  CapabilityTokenError,
  type FileAccessPolicyError,
  type PathPickerError,
  type MediaServerError,
  type ReviewBridgeError,
  type BridgeRequestLimitError,
  type BridgeRequestTimeoutError,
} from "../../shared/errors/desktopErrors";

type HostBridgeFailure =
  | EngineClientFailure
  | Schema.SchemaError
  | Config.ConfigError
  | FileAccessPolicyError
  | PathPickerError
  | MediaServerError
  | ReviewBridgeError
  | CapabilityTokenError
  | BridgeRequestLimitError
  | BridgeRequestTimeoutError;

type HostBridgeServiceShape = {
  handle(name: BridgeRequestName, params: unknown): Effect.Effect<unknown, HostBridgeFailure>;
};

export class HostBridgeService extends Context.Service<HostBridgeService, HostBridgeServiceShape>()(
  "@guerillaglass/desktop/HostBridgeService",
) {}

function reviewEventCreated(
  comment: BridgeRequests["ggReviewCreateComment"]["response"],
): ReviewBridgeEvent {
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

function logCaptureStatus(label: string, status: CaptureStatusResult) {
  return Effect.logInfo(label).pipe(
    Effect.annotateLogs({
      captureMetadataSource: status.captureMetadata?.source ?? null,
      captureSessionId: status.captureSessionId ?? null,
      component: "host-bridge-capture",
      eventsURL: status.eventsURL ?? null,
      isRecording: status.isRecording,
      isRunning: status.isRunning,
      lastErrorCode: status.lastError?.code ?? null,
      lastErrorMessage: status.lastError?.message ?? null,
      previewEncodeMs: status.telemetry.previewEncodeMs ?? null,
      recordingDurationSeconds: status.recordingDurationSeconds,
      recordingURL: status.recordingURL ?? null,
    }),
  );
}

function logPreviewFrame(label: string, frame: CapturePreviewFrameResult) {
  return Effect.logDebug(label).pipe(
    Effect.annotateLogs({
      component: "host-bridge-capture",
      frameBytesBase64Length: frame.frame?.bytesBase64.length ?? 0,
      frameId: frame.frame?.frameId ?? null,
      hasFrame: Boolean(frame.frame),
    }),
  );
}

function captureSessionIdFromStatus(
  status: BridgeRequests["ggEngineCaptureStatus"]["response"],
): string | null {
  return status.captureSessionId ?? null;
}

function reviewWorkflowChanged(
  response: BridgeRequests["ggReviewSetWorkflowStatus"]["response"],
): ReviewBridgeEvent {
  return {
    type: "workflow.statusChanged",
    reviewId: response.reviewId,
    status: response.status,
    emittedAt: response.updatedAt,
  };
}

export const layerHostBridgeService = Layer.effect(
  HostBridgeService,
  Effect.gen(function* () {
    const system = yield* SystemService;
    const permissions = yield* PermissionsService;
    const agent = yield* AgentService;
    const sources = yield* SourcesService;
    const capture = yield* CaptureService;
    const recording = yield* RecordingService;
    const exportService = yield* ExportService;
    const pathPolicy = yield* ProjectExportPathPolicy;
    const session = yield* ProjectSession;
    const reviewGateway = yield* ReviewGateway;
    const capabilities = yield* CapabilityGrantService;
    const shell = yield* DesktopShell;
    const grants = yield* FileAccessGrants;
    const mediaSourceService = yield* MediaSourceService;
    const projectService = yield* ProjectService;
    const limits = yield* BridgeRequestLimits;

    const handlers: Record<
      BridgeRequestName,
      (raw: unknown) => Effect.Effect<unknown, HostBridgeFailure, ProjectService>
    > = {
      ggEnginePing: Effect.fn("HostBridge.ggEnginePing")(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(bridgeDefinitionsByName.ggEnginePing.paramsSchema)(raw);
        return yield* system.ping;
      }),
      ggEngineCapabilities: Effect.fn("HostBridge.ggEngineCapabilities")(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineCapabilities.paramsSchema,
        )(raw);
        return yield* system.capabilities;
      }),
      ggEngineGetPermissions: Effect.fn("HostBridge.ggEngineGetPermissions")(function* (
        raw: unknown,
      ) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineGetPermissions.paramsSchema,
        )(raw);
        return yield* permissions.get;
      }),
      ggEngineAgentPreflight: Effect.fn("HostBridge.ggEngineAgentPreflight")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineAgentPreflight.paramsSchema,
        )(raw);
        return yield* agent.preflight(params);
      }),
      ggEngineAgentRun: Effect.fn("HostBridge.ggEngineAgentRun")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineAgentRun.paramsSchema,
        )(raw);
        return yield* agent.run(params);
      }),
      ggEngineAgentStatus: Effect.fn("HostBridge.ggEngineAgentStatus")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineAgentStatus.paramsSchema,
        )(raw);
        return yield* agent.status(params.jobId);
      }),
      ggEngineAgentApply: Effect.fn("HostBridge.ggEngineAgentApply")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineAgentApply.paramsSchema,
        )(raw);
        return yield* agent.apply(params.jobId, params);
      }),
      ggEngineRequestScreenRecordingPermission: Effect.fn(
        "HostBridge.ggEngineRequestScreenRecordingPermission",
      )(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineRequestScreenRecordingPermission.paramsSchema,
        )(raw);
        return yield* permissions.requestScreenRecording;
      }),
      ggEngineRequestMicrophonePermission: Effect.fn(
        "HostBridge.ggEngineRequestMicrophonePermission",
      )(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineRequestMicrophonePermission.paramsSchema,
        )(raw);
        return yield* permissions.requestMicrophone;
      }),
      ggEngineRequestInputMonitoringPermission: Effect.fn(
        "HostBridge.ggEngineRequestInputMonitoringPermission",
      )(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineRequestInputMonitoringPermission.paramsSchema,
        )(raw);
        return yield* permissions.requestInputMonitoring;
      }),
      ggEngineOpenInputMonitoringSettings: Effect.fn(
        "HostBridge.ggEngineOpenInputMonitoringSettings",
      )(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineOpenInputMonitoringSettings.paramsSchema,
        )(raw);
        return yield* permissions.openInputMonitoringSettings;
      }),
      ggEngineListSources: Effect.fn("HostBridge.ggEngineListSources")(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(bridgeDefinitionsByName.ggEngineListSources.paramsSchema)(
          raw,
        );
        return yield* sources.list;
      }),
      ggEngineStartDisplayCapture: Effect.fn("HostBridge.ggEngineStartDisplayCapture")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineStartDisplayCapture.paramsSchema,
        )(raw);
        yield* Effect.logInfo("starting display capture").pipe(
          Effect.annotateLogs({ component: "host-bridge-capture", params }),
        );
        return yield* capture
          .startDisplay(params)
          .pipe(Effect.tap((status) => logCaptureStatus("display capture started", status)));
      }),
      ggEngineStartCurrentWindowCapture: Effect.fn("HostBridge.ggEngineStartCurrentWindowCapture")(
        function* (raw: unknown) {
          const params = yield* Schema.decodeUnknownEffect(
            bridgeDefinitionsByName.ggEngineStartCurrentWindowCapture.paramsSchema,
          )(raw);
          yield* Effect.logInfo("starting current-window capture").pipe(
            Effect.annotateLogs({ component: "host-bridge-capture", params }),
          );
          return yield* capture
            .startCurrentWindow(params)
            .pipe(
              Effect.tap((status) => logCaptureStatus("current-window capture started", status)),
            );
        },
      ),
      ggEngineStartWindowCapture: Effect.fn("HostBridge.ggEngineStartWindowCapture")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineStartWindowCapture.paramsSchema,
        )(raw);
        yield* Effect.logInfo("starting window capture").pipe(
          Effect.annotateLogs({ component: "host-bridge-capture", params }),
        );
        return yield* capture
          .startWindow(params)
          .pipe(Effect.tap((status) => logCaptureStatus("window capture started", status)));
      }),
      ggEngineStopCapture: Effect.fn("HostBridge.ggEngineStopCapture")(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(bridgeDefinitionsByName.ggEngineStopCapture.paramsSchema)(
          raw,
        );
        return yield* capture.stop.pipe(
          Effect.tap((status) => logCaptureStatus("capture stopped", status)),
        );
      }),
      ggEngineStartRecording: Effect.fn("HostBridge.ggEngineStartRecording")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineStartRecording.paramsSchema,
        )(raw);
        yield* Effect.logInfo("starting recording").pipe(
          Effect.annotateLogs({ component: "host-bridge-capture", trackInputEvents: params }),
        );
        return yield* recording
          .start(params)
          .pipe(Effect.tap((status) => logCaptureStatus("recording started", status)));
      }),
      ggEngineStopRecording: Effect.fn("HostBridge.ggEngineStopRecording")(function* (
        raw: unknown,
      ) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineStopRecording.paramsSchema,
        )(raw);
        return yield* recording.stop.pipe(
          Effect.tap((status) => logCaptureStatus("recording stopped", status)),
        );
      }),
      ggEngineCaptureStatus: Effect.fn("HostBridge.ggEngineCaptureStatus")(function* (
        raw: unknown,
      ) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineCaptureStatus.paramsSchema,
        )(raw);
        return yield* capture.status.pipe(
          Effect.tap((status) => logCaptureStatus("capture status polled", status)),
        );
      }),
      ggEngineCapturePreviewFrame: Effect.fn("HostBridge.ggEngineCapturePreviewFrame")(function* (
        raw: unknown,
      ) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineCapturePreviewFrame.paramsSchema,
        )(raw);
        return yield* capture.previewFrame.pipe(
          Effect.tap((frame) => logPreviewFrame("capture preview frame polled", frame)),
        );
      }),
      ggEngineExportInfo: Effect.fn("HostBridge.ggEngineExportInfo")(function* (raw: unknown) {
        yield* Schema.decodeUnknownEffect(bridgeDefinitionsByName.ggEngineExportInfo.paramsSchema)(
          raw,
        );
        return yield* exportService.info;
      }),
      ggEngineRunExport: Effect.fn("HostBridge.ggEngineRunExport")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineRunExport.paramsSchema,
        )(raw);
        const outputURL = yield* pathPolicy.validateExportOutputPath(params.outputURL);
        return yield* exportService.run({
          ...params,
          outputURL: yield* outputUrlSchema
            .makeEffect(outputURL)
            .pipe(Effect.mapError((issue) => new Schema.SchemaError(issue))),
        });
      }),
      ggEngineRunCutPlanExport: Effect.fn("HostBridge.ggEngineRunCutPlanExport")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineRunCutPlanExport.paramsSchema,
        )(raw);
        const outputURL = yield* pathPolicy.validateExportOutputPath(params.outputURL);
        return yield* exportService.runCutPlan({
          ...params,
          outputURL: yield* outputUrlSchema
            .makeEffect(outputURL)
            .pipe(Effect.mapError((issue) => new Schema.SchemaError(issue))),
        });
      }),
      ggEngineProjectCurrent: Effect.fn("HostBridge.ggEngineProjectCurrent")(function* (
        raw: unknown,
      ) {
        yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineProjectCurrent.paramsSchema,
        )(raw);
        return yield* session.projectCurrent;
      }),
      ggEngineProjectOpen: Effect.fn("HostBridge.ggEngineProjectOpen")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineProjectOpen.paramsSchema,
        )(raw);
        const projectPath = yield* pathPolicy.validateProjectOpenPath(params.projectPath);
        return yield* session.projectOpen({
          ...params,
          projectPath: yield* projectPathSchema
            .makeEffect(projectPath)
            .pipe(Effect.mapError((issue) => new Schema.SchemaError(issue))),
        });
      }),
      ggEngineProjectSave: Effect.fn("HostBridge.ggEngineProjectSave")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineProjectSave.paramsSchema,
        )(raw);
        const projectPath = params.projectPath;
        if (projectPath) {
          const validatedProjectPath = yield* pathPolicy.validateProjectSavePath(projectPath);
          return yield* session.projectSave({
            ...params,
            projectPath: yield* projectPathSchema
              .makeEffect(validatedProjectPath)
              .pipe(Effect.mapError((issue) => new Schema.SchemaError(issue))),
          });
        }
        return yield* session.projectSave(params);
      }),
      ggEngineProjectRecents: Effect.fn("HostBridge.ggEngineProjectRecents")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggEngineProjectRecents.paramsSchema,
        )(raw);
        return yield* session.projectRecents(params);
      }),
      ggReviewSessionSnapshot: Effect.fn("HostBridge.ggReviewSessionSnapshot")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggReviewSessionSnapshot.paramsSchema,
        )(raw);
        return yield* reviewGateway.sessionSnapshot(params);
      }),
      ggGrantReviewMutationCapability: Effect.fn("HostBridge.ggGrantReviewMutationCapability")(
        function* (raw: unknown) {
          const params = yield* Schema.decodeUnknownEffect(
            bridgeDefinitionsByName.ggGrantReviewMutationCapability.paramsSchema,
          )(raw);
          const authToken = params.authToken.trim();
          if (!authToken) {
            return yield* new CapabilityTokenError({
              code: "CAPABILITY_TOKEN_INVALID",
              description: "Missing authToken for review mutation capability.",
            });
          }
          return yield* capabilities.mint({
            scope: "review:mutate",
            subject: reviewMutationSubject(params.reviewId),
            singleUse: true,
          });
        },
      ),
      ggReviewCreateComment: Effect.fn("HostBridge.ggReviewCreateComment")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggReviewCreateComment.paramsSchema,
        )(raw);
        const reviewId = params.reviewId;
        yield* capabilities.consume({
          token: params.capabilityToken,
          scope: "review:mutate",
          subject: reviewMutationSubject(reviewId),
        });
        const comment = yield* reviewGateway.createComment(params);
        yield* shell.publishReviewEvent(reviewEventCreated(comment));
        return comment;
      }),
      ggReviewSetWorkflowStatus: Effect.fn("HostBridge.ggReviewSetWorkflowStatus")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggReviewSetWorkflowStatus.paramsSchema,
        )(raw);
        const reviewId = params.reviewId;
        yield* capabilities.consume({
          token: params.capabilityToken,
          scope: "review:mutate",
          subject: reviewMutationSubject(reviewId),
        });
        const response = yield* reviewGateway.setWorkflowStatus(params);
        yield* shell.publishReviewEvent(reviewWorkflowChanged(response));
        return response;
      }),
      ggPickPath: Effect.fn("HostBridge.ggPickPath")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggPickPath.paramsSchema,
        )(raw);
        const pickedPath = yield* session.pickPath(params);
        if (pickedPath) {
          yield* grants.grantPickedPath(params.mode, pickedPath);
        }
        return pickedPath;
      }),
      ggReadTextFile: Effect.fn("HostBridge.ggReadTextFile")(function* (raw: unknown) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggReadTextFile.paramsSchema,
        )(raw);
        return yield* session.readTextFile(params.filePath);
      }),
      ggGrantMediaSourceCapability: Effect.fn("HostBridge.ggGrantMediaSourceCapability")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggGrantMediaSourceCapability.paramsSchema,
        )(raw);
        const filePath = params.filePath;
        const allowedMediaPath = yield* session.resolveAllowedMediaFilePath(filePath);
        return yield* capabilities.mint({
          scope: "media:resolve-source",
          subject: mediaSourceSubject(allowedMediaPath),
          singleUse: true,
        });
      }),
      ggResolveMediaSourceURL: Effect.fn("HostBridge.ggResolveMediaSourceURL")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggResolveMediaSourceURL.paramsSchema,
        )(raw);
        const filePath = params.filePath;
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
          token: params.capabilityToken,
          scope: "media:resolve-source",
          subject: mediaSourceSubject(allowedMediaPath),
        });
        return yield* mediaSourceService.resolveMediaSourceURL(allowedMediaPath);
      }),
      ggGrantCapturePreviewCapability: Effect.fn("HostBridge.ggGrantCapturePreviewCapability")(
        function* (raw: unknown) {
          const params = yield* Schema.decodeUnknownEffect(
            bridgeDefinitionsByName.ggGrantCapturePreviewCapability.paramsSchema,
          )(raw);
          const captureSessionId = params.captureSessionId;
          const status = yield* capture.status;
          yield* logCaptureStatus("capture preview capability requested", status).pipe(
            Effect.annotateLogs({ requestedCaptureSessionId: captureSessionId }),
          );
          if (!status.isRunning || captureSessionIdFromStatus(status) !== captureSessionId) {
            yield* Effect.logWarning("capture preview capability denied").pipe(
              Effect.annotateLogs({
                activeCaptureSessionId: captureSessionIdFromStatus(status),
                component: "host-bridge-capture",
                isRunning: status.isRunning,
                requestedCaptureSessionId: captureSessionId,
              }),
            );
            return yield* new CapabilityTokenError({
              code: "CAPABILITY_TOKEN_INVALID",
              description: "Capture preview capability requires the active capture session.",
            });
          }
          return yield* capabilities
            .mint({
              scope: "capture:resolve-preview-url",
              subject: capturePreviewSubject(captureSessionId),
              singleUse: true,
            })
            .pipe(
              Effect.tap(() =>
                Effect.logInfo("capture preview capability granted").pipe(
                  Effect.annotateLogs({
                    component: "host-bridge-capture",
                    requestedCaptureSessionId: captureSessionId,
                  }),
                ),
              ),
            );
        },
      ),
      ggResolveCapturePreviewURL: Effect.fn("HostBridge.ggResolveCapturePreviewURL")(function* (
        raw: unknown,
      ) {
        const params = yield* Schema.decodeUnknownEffect(
          bridgeDefinitionsByName.ggResolveCapturePreviewURL.paramsSchema,
        )(raw);
        const captureSessionId = params.captureSessionId;
        yield* Effect.logInfo("resolving capture preview URL").pipe(
          Effect.annotateLogs({ component: "host-bridge-capture", captureSessionId }),
        );
        yield* capabilities.consume({
          token: params.capabilityToken,
          scope: "capture:resolve-preview-url",
          subject: capturePreviewSubject(captureSessionId),
        });
        return yield* mediaSourceService
          .resolveCapturePreviewURL(() =>
            capture.previewFrame.pipe(
              Effect.tap((frame) => logPreviewFrame("initial capture preview frame", frame)),
            ),
          )
          .pipe(
            Effect.tap((previewURL) =>
              Effect.logInfo("capture preview URL resolved").pipe(
                Effect.annotateLogs({ component: "host-bridge-capture", previewURL }),
              ),
            ),
          );
      }),
    };
    return HostBridgeService.of({
      handle: Effect.fn("HostBridge.handle")((name: BridgeRequestName, params: unknown) =>
        limits
          .guard(name, handlers[name](params), params)
          .pipe(Effect.provideService(ProjectService, projectService)),
      ),
    });
  }),
);
