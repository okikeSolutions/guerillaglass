import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import { Effect, Exit, Layer, Schema, Stream, Cause } from "effect";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { messageFromUnknownError } from "@guerillaglass/engine/client/errors/clientErrors";
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

export type DesktopAppLayerOptions = {
  engineTransportLayer: Layer.Layer<EngineTransport, unknown, AppConfig>;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, AppConfig>;
  mediaSourceServiceLayer?: Layer.Layer<
    MediaSourceService,
    never,
    AppConfig | DesktopTempDirectory
  >;
  desktopShellLayer: Layer.Layer<DesktopShell, never, AppConfig>;
  projectSessionLayer: Layer.Layer<ProjectSession, never, AppConfig | DesktopTempDirectory>;
  desktopTempDirectoryLayer: Layer.Layer<DesktopTempDirectory, unknown, never>;
  enableCaptureStatusStream?: boolean;
  initialCaptureStatusDelayMs?: number;
};

/** Services composed at the desktop app composition root. */
export type DesktopAppServices =
  | AppConfig
  | EngineTransport
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

/** Creates the streaming program that forwards capture status updates through the app layer. */
export function makeCaptureStatusStreamEffect(
  initialDelayMs = 0,
): Effect.Effect<void, never, EngineTransport | DesktopShell> {
  return Effect.gen(function* () {
    if (initialDelayMs > 0) {
      yield* Effect.sleep(`${Math.max(0, initialDelayMs)} millis`);
    }

    const transport = yield* EngineTransport;
    const shell = yield* DesktopShell;

    const statusStream = transport["capture.statusStream"](undefined) as Stream.Stream<
      Schema.Schema.Type<typeof captureStatusResultSchema>,
      unknown,
      never
    >;

    yield* Stream.runForEach(statusStream, (captureStatus) =>
      Effect.exit(
        Schema.encodeUnknownEffect(Schema.toCodecJson(captureStatusResultSchema))(
          captureStatus,
        ).pipe(
          Effect.flatMap((encodedCaptureStatus) =>
            shell.publishCaptureStatus(encodedCaptureStatus as CaptureStatusResult),
          ),
        ),
      ).pipe(
        Effect.flatMap((sendResult) => {
          if (Exit.isSuccess(sendResult)) {
            return Effect.void;
          }
          return Effect.logWarning(
            `capture status delivery failed: ${messageFromUnknownError(
              Cause.squash(sendResult.cause),
              "capture status delivery failed",
            )}`,
          );
        }),
      ),
    ).pipe(
      Effect.catch((error) =>
        Effect.logWarning(
          `capture status stream failed: ${messageFromUnknownError(
            error,
            "capture status stream failed",
          )}`,
        ),
      ),
    );
  });
}

function makeCaptureStatusStreamLayer(
  options: DesktopAppLayerOptions,
): Layer.Layer<never, never, DesktopAppServices> {
  if (options.enableCaptureStatusStream === false) {
    return Layer.empty;
  }

  return Layer.effectDiscard(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const enabled = options.enableCaptureStatusStream ?? !config.captureBenchmarkEnabled;
      if (!enabled) return;
      yield* Effect.forkScoped(
        makeCaptureStatusStreamEffect(options.initialCaptureStatusDelayMs ?? 0),
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
    options.engineTransportLayer,
    options.reviewGatewayLayer ?? layerReviewGateway,
    mediaSourceServiceLayer,
    options.desktopShellLayer,
    projectSessionLayer,
    securityLayer,
    layerHostBridgeService,
  ).pipe(Layer.provideMerge(layerAppConfig));

  const servicesLayer = appServicesLayer.pipe(Layer.provideMerge(layerAppLogging));

  if (options.enableCaptureStatusStream === false) {
    return servicesLayer;
  }

  return makeCaptureStatusStreamLayer(options).pipe(Layer.provideMerge(servicesLayer));
}
