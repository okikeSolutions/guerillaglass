import { BunFileSystem, BunPath, BunSocket } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { makeEngineSocketProcess } from "./processBun.js";
import { makeEngineWireRpcClientProtocol } from "./wireProtocol.js";
import { EngineRpcs } from "@guerillaglass/engine/protocol/rpc/group";

/** Options for constructing the Bun-backed native engine transport layer. */
export type EngineTransportBunOptions = {
  /** Absolute path to the native engine executable or TypeScript stub. */
  readonly enginePath?: string;
};

/**
 * Builds the Bun-backed native engine transport layer.
 *
 * The layer starts the configured native engine process, waits for its socket
 * readiness line, connects a Bun TCP socket, and provides an Effect RPC client
 * through {@link EngineTransport}. The native process speaks the stable
 * Guerillaglass wire protocol; Effect RPC serialization remains contained in
 * this TypeScript client boundary.
 */
export function makeEngineTransportBunLive(options?: EngineTransportBunOptions) {
  const socketAndProtocolLive = Layer.unwrap(
    Effect.gen(function* () {
      const { address, authToken } = yield* makeEngineSocketProcess({
        enginePath: options?.enginePath,
      }).pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)));
      return Layer.effect(
        RpcClient.Protocol,
        makeEngineWireRpcClientProtocol({ authToken }),
      ).pipe(Layer.provide(BunSocket.layerNet({ host: address.host, port: address.port })));
    }),
  );

  return Layer.effect(EngineTransport, RpcClient.make(EngineRpcs)).pipe(
    Layer.provide(socketAndProtocolLive),
  );
}

/** Default Bun-backed native engine transport layer. */
export const EngineTransportBunLive = makeEngineTransportBunLive();
