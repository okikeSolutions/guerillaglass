import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import type { HttpClient } from "effect/http";
import { layerNoFollowFileIO, type NoFollowFileIO } from "../security/NoFollowFileIO";
import { captureStatusResultSchema } from "@guerillaglass/engine-contract/domains/capture";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Schedule, Schema } from "effect";
import { AgentService } from "@guerillaglass/engine-client/services/AgentService";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import type { EngineDomainServices } from "@guerillaglass/engine-client/services/domainServices";
import { ExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { ProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import { RecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService } from "@guerillaglass/engine-client/services/SystemService";
import { AppConfig, layerAppConfig } from "./AppConfig";
import { layerAppLogging, layerEffectDevTools } from "./AppLogging";
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

/** Implementations and polling settings selected by the desktop composition root. */
export type DesktopAppLayerOptions = {
  engineDomainServicesLayer: Layer.Layer<
    EngineDomainServices,
    unknown,
    AppConfig | DesktopTempDirectory | NoFollowFileIO
  >;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, AppConfig>;
  mediaSourceServiceLayer?: Layer.Layer<
    MediaSourceService,
    never,
    AppConfig | DesktopTempDirectory | NoFollowFileIO
  >;
  desktopShellLayer: Layer.Layer<DesktopShell, never, AppConfig | HttpClient.HttpClient>;
  projectSessionLayer: Layer.Layer<
    ProjectSession,
    never,
    AppConfig | DesktopTempDirectory | NoFollowFileIO
  >;
  desktopTempDirectoryLayer: Layer.Layer<DesktopTempDirectory, unknown, never>;
  enableCaptureStatusPolling?: boolean;
  initialCaptureStatusDelayMs?: number;
  captureStatusPollingIntervalMs?: number;
};

/** Services composed at the desktop app composition root. */
export type DesktopAppServices =
  | AppConfig
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
export const makeCaptureStatusPollingEffect = Effect.fn("AppLayer.makeCaptureStatusPollingEffect")(
  function (
    initialDelayMs = 0,
    intervalMs = 500,
  ): Effect.Effect<void, never, CaptureService | DesktopShell> {
    return Effect.gen(function* () {
      const capture = yield* CaptureService;
      const shell = yield* DesktopShell;
      const encodeStatus = Schema.encodeUnknownEffect(
        Schema.toCodecJson(captureStatusResultSchema),
      );
      const poll = Effect.fn("DesktopApp.pollCaptureStatus")(function* () {
        const captureStatus = yield* capture.status;
        const encodedCaptureStatus = yield* encodeStatus(captureStatus);
        const bridgedCaptureStatus =
          yield* Schema.decodeUnknownEffect(captureStatusResultSchema)(encodedCaptureStatus);
        yield* shell.publishCaptureStatus(bridgedCaptureStatus);
      });

      const worker = poll().pipe(
        Effect.tapError((error) => Effect.logWarning("capture status polling failed", error)),
        Effect.ignore,
        Effect.repeat(Schedule.spaced(`${Math.max(50, intervalMs)} millis`)),
      );
      yield* initialDelayMs > 0 ? worker.pipe(Effect.delay(`${initialDelayMs} millis`)) : worker;
    });
  },
);

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
      if (!enabled) {
        return;
      }
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

  const appServicesLayer = Layer.mergeAll(
    options.engineDomainServicesLayer.pipe(Layer.provideMerge(tempDirectoryLayer)),
    options.reviewGatewayLayer ?? layerReviewGateway,
    mediaSourceServiceLayer,
    options.desktopShellLayer,
    projectSessionLayer,
    securityLayer,
  ).pipe(Layer.provideMerge(layerAppConfig));

  const servicesLayer = layerHostBridgeService.pipe(
    Layer.provideMerge(appServicesLayer),
    Layer.provideMerge(Layer.mergeAll(layerAppLogging, layerEffectDevTools)),
  );

  if (options.enableCaptureStatusPolling === false) {
    return servicesLayer.pipe(
      Layer.provide(NodeServices.layer),
      Layer.provide(layerNoFollowFileIO),
      Layer.provide(NodeHttpClient.layerNodeHttp),
    );
  }

  return makeCaptureStatusPollingLayer(options).pipe(
    Layer.provideMerge(servicesLayer),
    Layer.provide(NodeServices.layer),
    Layer.provide(layerNoFollowFileIO),
    Layer.provide(NodeHttpClient.layerNodeHttp),
  );
}
