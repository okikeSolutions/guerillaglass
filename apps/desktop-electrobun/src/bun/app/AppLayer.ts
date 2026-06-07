import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import { Context, Effect, Exit, Layer, Schema, Stream, Cause } from "effect";
import {
  EngineTransport,
  type EngineTransportError,
} from "@guerillaglass/engine/client/service";
import { layerEngineTransportBun } from "@guerillaglass/engine/client/liveBun";
import { messageFromUnknownError } from "../../shared/errors";
import { MediaSourceService, layerMediaSourceService } from "../media/service";
import { ReviewGateway, layerReviewGateway } from "../review/service";

type DesktopCaptureStatusSinkService = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
};

export type DesktopAppLayerOptions = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
  engineTransportLayer?: Layer.Layer<EngineTransport, EngineTransportError, never>;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, never>;
  mediaSourceServiceLayer?: Layer.Layer<MediaSourceService, never, never>;
  enableCaptureStatusStream?: boolean;
  initialCaptureStatusDelayMs?: number;
};

/** Services composed at the desktop app composition root. */
export type DesktopAppServices =
  | EngineTransport
  | ReviewGateway
  | MediaSourceService
  | DesktopCaptureStatusSink;

/** Service tag for pushing capture status events from the app layer back to the shell. */
export class DesktopCaptureStatusSink extends Context.Service<
  DesktopCaptureStatusSink,
  DesktopCaptureStatusSinkService
>()("@guerillaglass/desktop/DesktopCaptureStatusSink") {}

/** Creates the streaming program that forwards capture status updates through the app layer. */
export function makeCaptureStatusStreamEffect(
  initialDelayMs = 0,
): Effect.Effect<void, never, EngineTransport | DesktopCaptureStatusSink> {
  return Effect.gen(function* () {
    if (initialDelayMs > 0) {
      yield* Effect.sleep(`${Math.max(0, initialDelayMs)} millis`);
    }

    const transport = yield* EngineTransport;
    const sink = yield* DesktopCaptureStatusSink;

    const statusStream = transport["capture.statusStream"](undefined) as Stream.Stream<
      Schema.Schema.Type<typeof captureStatusResultSchema>,
      unknown,
      never
    >;

    yield* Stream.runForEach(statusStream, (captureStatus) =>
      Effect.exit(
        Schema.encodeUnknownEffect(Schema.toCodecJson(captureStatusResultSchema))(captureStatus).pipe(
          Effect.flatMap((encodedCaptureStatus) =>
            Effect.sync(() => {
              sink.sendCaptureStatus(encodedCaptureStatus as CaptureStatusResult);
            }),
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
  const engineTransportLayer = options.engineTransportLayer ?? layerEngineTransportBun;

  const servicesLayer = Layer.mergeAll(
    engineTransportLayer,
    options.reviewGatewayLayer ?? layerReviewGateway,
    options.mediaSourceServiceLayer ?? layerMediaSourceService,
    Layer.succeed(DesktopCaptureStatusSink, {
      sendCaptureStatus: options.sendCaptureStatus,
    }),
  );

  if (options.enableCaptureStatusStream === false) {
    return servicesLayer;
  }

  return makeCaptureStatusStreamLayer(options).pipe(Layer.provideMerge(servicesLayer));
}
