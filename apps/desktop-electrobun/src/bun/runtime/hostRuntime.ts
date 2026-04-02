import { type CaptureStatusResult } from "@guerillaglass/engine-protocol";
import { Cause, Context, Effect, Either, Exit, Layer, ManagedRuntime, Option, Scope } from "effect";
import { EngineClientError, messageFromUnknownError } from "../../shared/errors";
import { EngineTransport, EngineTransportLive } from "../engine/service";
import { MediaSourceService, MediaSourceServiceLive } from "../media/service";
import { ReviewGateway, ReviewGatewayLive } from "../review/service";

type HostCaptureStatusSinkService = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
};

type HostRuntimeOptions = {
  sendCaptureStatus: (captureStatus: CaptureStatusResult) => void;
  engineTransportLayer?: Layer.Layer<EngineTransport, EngineClientError, never>;
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
export type HostRuntimeError = EngineClientError;

/** Service tag for pushing capture status events from the runtime back to the app shell. */
export class HostCaptureStatusSink extends Context.Tag(
  "@guerillaglass/desktop/HostCaptureStatusSink",
)<HostCaptureStatusSink, HostCaptureStatusSinkService>() {}

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
  const failure = Cause.failureOption(cause);
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

/** Creates the polling program that forwards capture status updates through the host runtime. */
export function makeCaptureStatusStreamEffect(
  initialDelayMs = 0,
): Effect.Effect<void, never, EngineTransport | HostCaptureStatusSink> {
  return Effect.gen(function* () {
    const transport = yield* EngineTransport;
    const sink = yield* HostCaptureStatusSink;
    let nextDelay = Math.max(0, initialDelayMs);

    while (true) {
      if (nextDelay > 0) {
        yield* Effect.sleep(`${nextDelay} millis`);
      }

      const result = yield* Effect.either(transport.captureStatus);
      if (Either.isLeft(result)) {
        nextDelay = 1000;
        yield* Effect.logWarning(
          `capture status stream tick failed: ${messageFromUnknownError(result.left, "capture status stream failed")}`,
        );
        continue;
      }

      nextDelay = captureStatusStreamInterval(result.right);
      const sendResult = yield* Effect.exit(
        Effect.sync(() => {
          sink.sendCaptureStatus(result.right);
        }),
      );
      if (Exit.isFailure(sendResult)) {
        nextDelay = 1000;
        yield* Effect.logWarning(
          `capture status delivery failed: ${messageFromUnknownError(
            Cause.squash(sendResult.cause),
            "capture status delivery failed",
          )}`,
        );
      }
    }
  });
}

function makeCaptureStatusStreamLayer(
  options: HostRuntimeOptions,
): Layer.Layer<never, never, HostRuntimeServices> {
  if (options.enableCaptureStatusStream === false) {
    return Layer.empty;
  }

  return Layer.scopedDiscard(
    Effect.forkScoped(makeCaptureStatusStreamEffect(options.initialCaptureStatusDelayMs ?? 0)),
  );
}

/** Composes the live host layer used by the managed Bun runtime. */
export function makeHostLive(options: HostRuntimeOptions) {
  const servicesLayer = Layer.mergeAll(
    options.engineTransportLayer ?? EngineTransportLive,
    options.reviewGatewayLayer ?? ReviewGatewayLive,
    options.mediaSourceServiceLayer ?? MediaSourceServiceLive,
    Layer.succeed(HostCaptureStatusSink, {
      sendCaptureStatus: options.sendCaptureStatus,
    }),
  );

  if (options.enableCaptureStatusStream === false) {
    return servicesLayer;
  }

  return Layer.scopedContext(
    Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const memoizedServicesLayer = yield* Layer.memoize(servicesLayer);
      const services = yield* Layer.buildWithScope(memoizedServicesLayer, scope);

      yield* Layer.buildWithScope(
        makeCaptureStatusStreamLayer(options).pipe(Layer.provide(memoizedServicesLayer)),
        scope,
      );

      return services;
    }),
  );
}

/** Creates the managed Bun host runtime and starts the capture-status stream when enabled. */
export async function createHostRuntime(options: HostRuntimeOptions): Promise<HostRuntime> {
  const runtime = ManagedRuntime.make(makeHostLive(options));
  await runtime.runtime();

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
