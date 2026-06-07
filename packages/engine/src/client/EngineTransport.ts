import { Context, Layer } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import { EngineRpcs, type EngineRpcClient } from "@guerillaglass/engine/protocol/rpc/group";
import { type EngineRpcError } from "@guerillaglass/engine/protocol/rpc/errors";
import { layerEngineRpcClientProtocol } from "@guerillaglass/engine/client/rpc/protocol";

export type EngineTransportError = EngineRpcError | RpcClientError;
export type EngineTransportService = EngineRpcClient;

export class EngineTransport extends Context.Service<EngineTransport, EngineTransportService>()(
  "@guerillaglass/desktop/EngineTransport",
) {}

export function makeEngineTransportLive(options?: { readonly enginePath?: string }) {
  const protocolLive = layerEngineRpcClientProtocol({ enginePath: options?.enginePath }).pipe(
    Layer.provide(RpcSerialization.layerNdJsonRpc()),
  );

  return Layer.effect(EngineTransport, RpcClient.make(EngineRpcs)).pipe(
    Layer.provide(protocolLive),
  );
}

export const EngineTransportLive = makeEngineTransportLive();
