import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Option, Schema, Stream } from "effect";
import { Socket } from "effect/unstable/socket";
import { EngineClientError, messageFromUnknownError } from "../../shared/errors";
import {
  EngineTransport,
  type EngineTransportError,
} from "@guerillaglass/engine/client/service";
import { EngineTransportBunLive } from "@guerillaglass/engine/client/liveBun";
import { MediaSourceService, MediaSourceServiceLive } from "../media/service";
import { ReviewGateway, ReviewGatewayLive } from "../review/service";

type HostCaptureStatusSinkService = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
};

type HostRuntimeOptions = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
  engineTransportLayer?: Layer.Layer<EngineTransport, EngineTransportError, never>;
  reviewGatewayLayer?: Layer.Layer<ReviewGateway, never, never>;
  mediaSourceServiceLayer?: Layer.Layer<MediaSourceService, never, never>;
  enableCaptureStatusStream?: boolean;
  initialCaptureStatusDelayMs?: number;
};

/** Services bundled into the managed Bun host runtime. */
export type HostRuntimeServices =
  | EngineTransport
  | ReviewGateway
  | MediaSourceService
  | HostCaptureStatusSink;
/** Failures that can occur while constructing the Bun host runtime. */
export type HostRuntimeError = EngineClientError | EngineTransportError | Socket.SocketError;

/** Service tag for pushing capture status events from the runtime back to the app shell. */
export class HostCaptureStatusSink extends Context.Service<
  HostCaptureStatusSink,
  HostCaptureStatusSinkService
>()("@guerillaglass/desktop/HostCaptureStatusSink") {}

/** Managed runtime handle used by the Bun app and bridge execution edges. */
export type HostRuntime = {
  runtime: ManagedRuntime.ManagedRuntime<HostRuntimeServices, HostRuntimeError>;
  runPromise: <A, E, R extends HostRuntimeServices>(
    effect: Effect.Effect<A, E, R>,
    options?: { readonly signal?: AbortSignal | undefined },
  ) => Promise<A>;
  runFork: ManagedRuntime.ManagedRuntime<HostRuntimeServices, HostRuntimeError>["runFork"];
  dispose: () => Promise<void>;
};

function throwManagedRuntimeFailure(cause: Cause.Cause<unknown>): never {
  const failure = Cause.findErrorOption(cause);
  if (Option.isSome(failure)) {
    throw failure.value;
  }
  throw Cause.squash(cause);
}

/** Selects the next capture-status polling interval from the latest engine status. */
export function captureStatusStreamInterval(status: CaptureStatusResult): number {
  if (status.isRecording) {
    return 250;
  }
  if (status.isRunning) {
    return 500;
  }
  return 1000;
}

/** Creates the streaming program that forwards capture status updates through the host runtime. */
export function makeCaptureStatusStreamEffect(
  initialDelayMs = 0,
): Effect.Effect<void, never, EngineTransport | HostCaptureStatusSink> {
  return Effect.gen(function* () {
    if (initialDelayMs > 0) {
      yield* Effect.sleep(`${Math.max(0, initialDelayMs)} millis`);
    }

    const transport = yield* EngineTransport;
    const sink = yield* HostCaptureStatusSink;

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
  options: HostRuntimeOptions,
): Layer.Layer<never, never, HostRuntimeServices> {
  if (options.enableCaptureStatusStream === false) {
    return Layer.empty;
  }

  return Layer.effectDiscard(
    Effect.forkScoped(makeCaptureStatusStreamEffect(options.initialCaptureStatusDelayMs ?? 0)),
  );
}

/** Composes the live host layer used by the managed Bun runtime. */
export function makeHostLive(options: HostRuntimeOptions) {
  const engineTransportLayer = options.engineTransportLayer ?? EngineTransportBunLive;

  const servicesLayer = Layer.mergeAll(
    engineTransportLayer,
    options.reviewGatewayLayer ?? ReviewGatewayLive,
    options.mediaSourceServiceLayer ?? MediaSourceServiceLive,
    Layer.succeed(HostCaptureStatusSink, {
      sendCaptureStatus: options.sendCaptureStatus,
    }),
  );

  if (options.enableCaptureStatusStream === false) {
    return servicesLayer;
  }

  return makeCaptureStatusStreamLayer(options).pipe(Layer.provideMerge(servicesLayer));
}

/** Creates the managed Bun host runtime and starts the capture-status stream when enabled. */
export async function createHostRuntime(options: HostRuntimeOptions): Promise<HostRuntime> {
  const runtime = ManagedRuntime.make(makeHostLive(options));
  await runtime.context();

  return {
    runtime,
    runPromise: async (effect, runOptions) =>
      Exit.match(await runtime.runPromiseExit(effect, runOptions), {
        onFailure: throwManagedRuntimeFailure,
        onSuccess: (value) => value,
      }),
    runFork: runtime.runFork.bind(runtime),
    dispose: async () => runtime.dispose(),
  };
}
