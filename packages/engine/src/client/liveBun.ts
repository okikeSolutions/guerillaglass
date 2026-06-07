import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as BunSocket from "@effect/platform-bun/BunSocket";
import { Effect, Layer, Schedule } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { Socket } from "effect/unstable/socket";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { makeEngineSocketProcess } from "./processBun.js";
import { makeEngineWireRpcClientProtocol } from "./wireProtocol.js";
import { EngineRpcs } from "@guerillaglass/engine/protocol/rpc/group";

/** Options for constructing the Bun-backed native engine transport layer. */
export type EngineTransportBunOptions = {
  /** Absolute path to the native engine executable or TypeScript stub. */
  readonly enginePath?: string;
};

const engineProcessPlatformLayer = BunChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)),
);

const socketConnectRetrySchedule = Schedule.exponential("25 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.tapInput((error) =>
    Effect.logDebug("retrying engine socket connect after readiness", { error }),
  ),
);

function makeEngineSocketLayer(address: { readonly host: string; readonly port: number }) {
  return Layer.effect(
    Socket.Socket,
    BunSocket.makeNet({ host: address.host, port: address.port }).pipe(
      Effect.retry(socketConnectRetrySchedule),
      Effect.tap(() => Effect.logInfo("engine socket connected", address)),
      Effect.withSpan("engine.socket.connect", {
        attributes: {
          "engine.socket.host": address.host,
          "engine.socket.port": address.port,
        },
      }),
    ),
  );
}

/**
 * Builds the Bun-backed native engine transport layer.
 *
 * The layer starts the configured native engine process, waits for its socket
 * readiness line, connects a Bun TCP socket, and provides an Effect RPC client
 * through {@link EngineTransport}. The native process speaks the stable
 * Guerillaglass wire protocol; Effect RPC serialization remains contained in
 * this TypeScript client boundary.
 */
export function makeLayerEngineTransportBun(options?: EngineTransportBunOptions) {
  const socketAndProtocolLive = Layer.unwrap(
    Effect.gen(function* () {
      const { address, authToken } = yield* makeEngineSocketProcess({
        enginePath: options?.enginePath,
      }).pipe(Effect.provide(engineProcessPlatformLayer));
      return Layer.effect(
        RpcClient.Protocol,
        makeEngineWireRpcClientProtocol({ authToken }),
      ).pipe(Layer.provide(makeEngineSocketLayer(address)));
    }).pipe(
      Effect.annotateLogs({ component: "engine-client", transport: "socket" }),
      Effect.withSpan("engine.transport.bun.layer"),
    ),
  );

  return Layer.effect(EngineTransport, RpcClient.make(EngineRpcs)).pipe(
    Layer.provide(socketAndProtocolLive),
  );
}

/** Default Bun-backed native engine transport layer. */
export const layerEngineTransportBun = makeLayerEngineTransportBun();
