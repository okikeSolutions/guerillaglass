import { existsSync } from "node:fs";
import { Deferred, Effect, Fiber, Layer, Scope } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { RpcClientDefect, RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type { FromServerEncoded, RequestEncoded } from "effect/unstable/rpc/RpcMessage";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import {
  EngineClientError,
  messageFromUnknownError,
} from "@guerillaglass/engine/client/errors/clientErrors";
import { resolveEnginePath } from "@guerillaglass/engine/client/config/paths";

const textEncoder = new TextEncoder();

export type EngineRpcProtocolOptions = {
  readonly enginePath?: string;
};

function resolveEngineCommand(enginePath: string): Effect.Effect<string[], EngineClientError> {
  if (!existsSync(enginePath)) {
    return Effect.fail(
      new EngineClientError({
        code: "ENGINE_PROCESS_UNAVAILABLE",
        description: `Engine executable not found at ${enginePath}. Run bun run swift:build or set GG_ENGINE_PATH.`,
      }),
    );
  }
  return Effect.succeed(enginePath.endsWith(".ts") ? ["bun", enginePath] : [enginePath]);
}

function protocolDefect(message: string, cause: unknown): RpcClientError {
  return new RpcClientError({
    reason: new RpcClientDefect({ message, cause }),
  });
}

type InternalResponseMap = Map<string, Deferred.Deferred<FromServerEncoded, RpcClientError>>;

type ActiveStreamMap = Map<string, Fiber.Fiber<void, never>>;

function readStdoutEffect(
  process: Bun.PipedSubprocess,
  parser: RpcSerialization.Parser,
  writeResponse: (clientId: number, response: FromServerEncoded) => Effect.Effect<void>,
  clientIds: ReadonlySet<number>,
  requestClientMap: Map<string, number>,
  internalResponseMap: InternalResponseMap,
): Effect.Effect<void, never> {
  if (!process.stdout) {
    return Effect.void;
  }
  return Effect.acquireUseRelease(
    Effect.sync(() => process.stdout!.getReader()),
    (reader) =>
      Effect.forever(
        Effect.tryPromise({
          try: () => reader.read(),
          catch: (cause) => protocolDefect("Error reading engine stdout", cause),
        }).pipe(
          Effect.flatMap(({ value, done }) => {
            if (done) {
              return Effect.interrupt;
            }
            return Effect.try({
              try: () => parser.decode(value) as ReadonlyArray<FromServerEncoded>,
              catch: (cause) => protocolDefect("Error decoding engine RPC response", cause),
            });
          }),
          Effect.flatMap((responses) =>
            Effect.forEach(
              responses,
              (response) => {
                if ("requestId" in response) {
                  const internalResponse = internalResponseMap.get(response.requestId);
                  if (internalResponse !== undefined) {
                    if (response._tag === "Exit") {
                      internalResponseMap.delete(response.requestId);
                    }
                    return Deferred.succeed(internalResponse, response).pipe(Effect.asVoid);
                  }

                  const clientId = requestClientMap.get(response.requestId);
                  if (clientId !== undefined) {
                    if (response._tag === "Exit") {
                      requestClientMap.delete(response.requestId);
                    }
                    return writeResponse(clientId, response);
                  }
                }
                return Effect.forEach(clientIds, (clientId) => writeResponse(clientId, response), {
                  discard: true,
                });
              },
              { discard: true },
            ),
          ),
        ),
      ).pipe(
        Effect.catch((error) =>
          Effect.forEach(
            clientIds,
            (clientId) =>
              writeResponse(clientId, {
                _tag: "ClientProtocolError",
                error,
              }),
            { discard: true },
          ),
        ),
      ),
    (reader) => Effect.sync(() => reader.releaseLock()),
  );
}

function readStderrEffect(process: Bun.PipedSubprocess): Effect.Effect<void, never> {
  if (!process.stderr) {
    return Effect.void;
  }
  const decoder = new TextDecoder();
  return Effect.acquireUseRelease(
    Effect.sync(() => process.stderr!.getReader()),
    (reader) =>
      Effect.forever(
        Effect.tryPromise({
          try: () => reader.read(),
          catch: (cause) =>
            new EngineClientError({
              code: "ENGINE_PROCESS_FAILED",
              description: messageFromUnknownError(cause, "Error reading engine stderr."),
              cause,
            }),
        }).pipe(
          Effect.flatMap(({ value, done }) => {
            if (done) {
              return Effect.interrupt;
            }
            const line = decoder.decode(value).trim();
            return line.length > 0 ? Effect.logError(`[engine] ${line}`) : Effect.void;
          }),
        ),
      ).pipe(Effect.catch(() => Effect.void)),
    (reader) => Effect.sync(() => reader.releaseLock()),
  );
}

function captureStatusStreamInterval(status: unknown): number {
  if (typeof status !== "object" || status === null) {
    return 1000;
  }
  const candidate = status as { readonly isRecording?: unknown; readonly isRunning?: unknown };
  if (candidate.isRecording === true) {
    return 250;
  }
  if (candidate.isRunning === true) {
    return 500;
  }
  return 1000;
}

function writeProcessRequest(
  process: Bun.PipedSubprocess,
  parser: RpcSerialization.Parser,
  request: RequestEncoded,
): Effect.Effect<void, RpcClientError> {
  const encoded = parser.encode(request);
  if (encoded === undefined) {
    return Effect.void;
  }
  const bytes = typeof encoded === "string" ? textEncoder.encode(encoded) : encoded;
  return Effect.try({
    try: () => process.stdin.write(bytes),
    catch: (cause) => protocolDefect("Failed to write engine RPC request", cause),
  }).pipe(Effect.asVoid);
}

const streamSourceForTag = (tag: string): string | undefined => {
  switch (tag) {
    case "capture.statusStream":
      return "capture.status";
    case "capture.previewFrameStream":
      return "capture.previewFrame";
    default:
      return undefined;
  }
};

export function makeEngineRpcClientProtocol(options: EngineRpcProtocolOptions = {}) {
  return RpcClient.Protocol.make(
    Effect.fnUntraced(function* (writeResponse, clientIds) {
      const serialization = yield* RpcSerialization.RpcSerialization;
      const enginePath = options.enginePath ?? resolveEnginePath();
      const command = yield* resolveEngineCommand(enginePath).pipe(
        Effect.mapError((cause) => protocolDefect("Engine process unavailable", cause)),
      );
      const parser = serialization.makeUnsafe();
      const requestClientMap = new Map<string, number>();
      const internalResponseMap: InternalResponseMap = new Map();
      const activeStreamMap: ActiveStreamMap = new Map();
      let currentError: RpcClientError | undefined;
      let internalRequestId = -1;

      const process = yield* Effect.acquireRelease(
        Effect.try({
          try: () =>
            Bun.spawn({
              cmd: command,
              stdin: "pipe",
              stdout: "pipe",
              stderr: "pipe",
            }),
          catch: (cause) => protocolDefect("Failed to spawn engine process", cause),
        }),
        (process) =>
          Effect.sync(() => {
            process.stdin.end();
            process.kill();
          }),
      );

      yield* readStdoutEffect(
        process,
        parser,
        writeResponse,
        clientIds,
        requestClientMap,
        internalResponseMap,
      ).pipe(Effect.forkScoped);
      yield* readStderrEffect(process).pipe(Effect.forkScoped);
      yield* Effect.tryPromise(() => process.exited).pipe(
        Effect.flatMap((exitCode) => {
          currentError = protocolDefect("Engine process exited", exitCode);
          return Effect.forEach(
            clientIds,
            (clientId) =>
              writeResponse(clientId, {
                _tag: "ClientProtocolError",
                error: currentError!,
              }),
            { discard: true },
          );
        }),
        Effect.catch(() => Effect.void),
        Effect.forkScoped,
      );

      return {
        send(clientId, request) {
          if (currentError) {
            return Effect.fail(currentError);
          }

          if (request._tag === "Interrupt") {
            const activeStream = activeStreamMap.get(request.requestId);
            if (activeStream !== undefined) {
              activeStreamMap.delete(request.requestId);
              requestClientMap.delete(request.requestId);
              return Fiber.interrupt(activeStream).pipe(Effect.asVoid);
            }
          }

          if (request._tag === "Request") {
            const streamSource = streamSourceForTag(request.tag);
            if (streamSource !== undefined) {
              requestClientMap.set(request.id, clientId);
              return Effect.gen(function* () {
                const streamEffect = Effect.forever(
                  Effect.gen(function* () {
                    const internalId = String(internalRequestId--);
                    const deferred = yield* Deferred.make<FromServerEncoded, RpcClientError>();
                    internalResponseMap.set(internalId, deferred);
                    yield* writeProcessRequest(process, parser, {
                      _tag: "Request",
                      id: internalId,
                      tag: streamSource,
                      payload: undefined,
                      headers: [],
                    });

                    const response = yield* Deferred.await(deferred);
                    if (response._tag === "Exit" && response.exit._tag === "Success") {
                      yield* writeResponse(clientId, {
                        _tag: "Chunk",
                        requestId: request.id,
                        values: [response.exit.value],
                      });
                      yield* Effect.sleep(
                        `${
                          request.tag === "capture.statusStream"
                            ? captureStatusStreamInterval(response.exit.value)
                            : 250
                        } millis`,
                      );
                      return;
                    }

                    if (response._tag === "Exit") {
                      yield* writeResponse(clientId, {
                        _tag: "Exit",
                        requestId: request.id,
                        exit: response.exit,
                      });
                      return yield* Effect.interrupt;
                    }
                  }),
                ).pipe(
                  Effect.catch((error: RpcClientError) =>
                    writeResponse(clientId, {
                      _tag: "ClientProtocolError",
                      error,
                    }),
                  ),
                );
                const fiber = yield* Effect.forkDetach(streamEffect);
                activeStreamMap.set(request.id, fiber);
              });
            }

            requestClientMap.set(request.id, clientId);
          }
          if (request._tag === "Request") {
            return writeProcessRequest(process, parser, request);
          }
          const encoded = parser.encode(request);
          if (encoded === undefined) {
            return Effect.void;
          }
          const bytes = typeof encoded === "string" ? textEncoder.encode(encoded) : encoded;
          return Effect.try({
            try: () => process.stdin.write(bytes),
            catch: (cause) => protocolDefect("Failed to write engine RPC request", cause),
          }).pipe(Effect.asVoid);
        },
        supportsAck: false,
        supportsTransferables: false,
      };
    }),
  );
}

export function layerEngineRpcClientProtocol(options: EngineRpcProtocolOptions = {}) {
  return Layer.effect(RpcClient.Protocol, makeEngineRpcClientProtocol(options));
}

export type EngineRpcClientProtocolServices = Scope.Scope | RpcSerialization.RpcSerialization;
