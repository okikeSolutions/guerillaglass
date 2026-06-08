import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import { Effect, Exit, Layer, Schema, Stream, Cause } from "effect";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { messageFromUnknownError } from "@guerillaglass/engine/client/errors/clientErrors";
import { MediaSourceService, layerMediaSourceService } from "../media/service";
import { ReviewGateway, layerReviewGateway } from "../review/service";
import { DesktopShell } from "../shell/DesktopShell";
import { ProjectSession } from "../session/ProjectSession";
import { HostBridgeService, layerHostBridgeService } from "../bridge/HostBridgeService";

export type DesktopAppLayerOptions = {
  engineTransportLayer: Layer.Layer<EngineTransport, unknown, never>;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, never>;
  mediaSourceServiceLayer?: Layer.Layer<MediaSourceService, never, never>;
  desktopShellLayer: Layer.Layer<DesktopShell, never, never>;
  projectSessionLayer: Layer.Layer<ProjectSession, never, never>;
  enableCaptureStatusStream?: boolean;
  initialCaptureStatusDelayMs?: number;
};

/** Services composed at the desktop app composition root. */
export type DesktopAppServices =
  | EngineTransport
  | ReviewGateway
  | MediaSourceService
  | DesktopShell
  | ProjectSession
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
    Effect.forkScoped(makeCaptureStatusStreamEffect(options.initialCaptureStatusDelayMs ?? 0)),
  );
}

/** Composes the desktop app layer used by the managed runtime. */
export function makeLayerDesktopApp(options: DesktopAppLayerOptions) {
  const servicesLayer = Layer.mergeAll(
    options.engineTransportLayer,
    options.reviewGatewayLayer ?? layerReviewGateway,
    options.mediaSourceServiceLayer ?? layerMediaSourceService,
    options.desktopShellLayer,
    options.projectSessionLayer,
    layerHostBridgeService,
  );

  if (options.enableCaptureStatusStream === false) {
    return servicesLayer;
  }

  return makeCaptureStatusStreamLayer(options).pipe(Layer.provideMerge(servicesLayer));
}
