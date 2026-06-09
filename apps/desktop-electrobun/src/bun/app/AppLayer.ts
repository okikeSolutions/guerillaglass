import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { Effect, Exit, Layer, Schema, Cause } from "effect";
import { EngineClient } from "@guerillaglass/engine-client/service";
import { AgentService, layerAgentService } from "@guerillaglass/engine-client/services/AgentService";
import { CaptureService, layerCaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import { ExportService, layerExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService, layerPermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { ProjectService, layerProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import { RecordingService, layerRecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService, layerSourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService, layerSystemService } from "@guerillaglass/engine-client/services/SystemService";
import { AppConfig, layerAppConfig } from "./AppConfig";
import { layerAppLogging } from "./AppLogging";
import { MediaSourceService, layerMediaSourceService } from "../media/service";
import { ReviewGateway, layerReviewGateway } from "../review/service";
import { DesktopShell } from "../shell/DesktopShell";
import { ProjectSession } from "../session/ProjectSession";
import { HostBridgeService, layerHostBridgeService } from "../bridge/HostBridgeService";
import { BridgeRequestLimits, layerBridgeRequestLimits } from "../security/BridgeRequestLimits";
import { DesktopTempDirectory } from "../security/DesktopTempDirectory";
import { FileAccessGrants, layerFileAccessGrants } from "../security/FileAccessGrants";
import {
  CapabilityGrantService,
  layerCapabilityGrantService,
} from "../security/DesktopCapabilities";
import {
  ProjectExportPathPolicy,
  layerProjectExportPathPolicy,
} from "../security/ProjectExportPathPolicy";

function messageFromUnknownError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export type DesktopAppLayerOptions = {
  engineClientLayer: Layer.Layer<EngineClient, unknown, AppConfig>;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, AppConfig>;
  mediaSourceServiceLayer?: Layer.Layer<
    MediaSourceService,
    never,
    AppConfig | DesktopTempDirectory
  >;
  desktopShellLayer: Layer.Layer<DesktopShell, never, AppConfig>;
  projectSessionLayer: Layer.Layer<ProjectSession, never, AppConfig | DesktopTempDirectory>;
  desktopTempDirectoryLayer: Layer.Layer<DesktopTempDirectory, unknown, never>;
  enableCaptureStatusPolling?: boolean;
  initialCaptureStatusDelayMs?: number;
  captureStatusPollingIntervalMs?: number;
};

/** Services composed at the desktop app composition root. */
export type DesktopAppServices =
  | AppConfig
  | EngineClient
  | AgentService
  | CaptureService
  | ExportService
  | PermissionsService
  | ProjectService
  | RecordingService
  | SourcesService
  | SystemService
  | ReviewGateway
  | MediaSourceService
  | DesktopShell
  | ProjectSession
  | DesktopTempDirectory
  | BridgeRequestLimits
  | FileAccessGrants
  | CapabilityGrantService
  | ProjectExportPathPolicy
  | HostBridgeService;

/** Creates the polling program that forwards capture status updates through the app layer. */
export function makeCaptureStatusPollingEffect(
  initialDelayMs = 0,
  intervalMs = 500,
): Effect.Effect<void, never, CaptureService | DesktopShell> {
  return Effect.gen(function* () {
    if (initialDelayMs > 0) {
      yield* Effect.sleep(`${Math.max(0, initialDelayMs)} millis`);
    }

    const capture = yield* CaptureService;
    const shell = yield* DesktopShell;

    while (true) {
      yield* Effect.exit(
        capture.status.pipe(
          Effect.flatMap((captureStatus) =>
            Schema.encodeUnknownEffect(Schema.toCodecJson(captureStatusResultSchema))(
              captureStatus,
            ).pipe(
              Effect.flatMap((encodedCaptureStatus) =>
                shell.publishCaptureStatus(encodedCaptureStatus as CaptureStatusResult),
              ),
            ),
          ),
        ),
      ).pipe(
        Effect.flatMap((sendResult) => {
          if (Exit.isSuccess(sendResult)) {
            return Effect.void;
          }
          return Effect.logWarning(
            `capture status polling failed: ${messageFromUnknownError(
              Cause.squash(sendResult.cause),
              "capture status polling failed",
            )}`,
          );
        }),
      );
      yield* Effect.sleep(`${Math.max(50, intervalMs)} millis`);
    }
  });
}

function makeCaptureStatusPollingLayer(
  options: DesktopAppLayerOptions,
): Layer.Layer<never, never, DesktopAppServices> {
  if (options.enableCaptureStatusPolling === false) {
    return Layer.empty;
  }

  return Layer.effectDiscard(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const enabled = options.enableCaptureStatusPolling ?? !config.captureBenchmarkEnabled;
      if (!enabled) return;
      yield* Effect.forkScoped(
        makeCaptureStatusPollingEffect(
          options.initialCaptureStatusDelayMs ?? 0,
          options.captureStatusPollingIntervalMs ?? 500,
        ),
      );
    }),
  );
}

/** Composes the desktop app layer used by the managed runtime. */
export function makeLayerDesktopApp(options: DesktopAppLayerOptions) {
  const tempDirectoryLayer = options.desktopTempDirectoryLayer;
  const securityLayer = Layer.mergeAll(
    layerBridgeRequestLimits,
    layerCapabilityGrantService,
    layerProjectExportPathPolicy,
  ).pipe(Layer.provideMerge(layerFileAccessGrants));

  const projectSessionLayer = options.projectSessionLayer.pipe(
    Layer.provideMerge(tempDirectoryLayer),
  );
  const mediaSourceServiceLayer = (options.mediaSourceServiceLayer ?? layerMediaSourceService).pipe(
    Layer.provideMerge(tempDirectoryLayer),
  );

  const engineDomainServicesLayer = Layer.mergeAll(
    layerSystemService,
    layerPermissionsService,
    layerSourcesService,
    layerCaptureService,
    layerRecordingService,
    layerProjectService,
    layerExportService,
    layerAgentService,
  ).pipe(Layer.provideMerge(options.engineClientLayer));

  const appServicesLayer = Layer.mergeAll(
    engineDomainServicesLayer,
    options.reviewGatewayLayer ?? layerReviewGateway,
    mediaSourceServiceLayer,
    options.desktopShellLayer,
    projectSessionLayer,
    securityLayer,
    layerHostBridgeService,
  ).pipe(Layer.provideMerge(layerAppConfig));

  const servicesLayer = appServicesLayer.pipe(Layer.provideMerge(layerAppLogging));

  if (options.enableCaptureStatusPolling === false) {
    return servicesLayer;
  }

  return makeCaptureStatusPollingLayer(options).pipe(Layer.provideMerge(servicesLayer));
}
