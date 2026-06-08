import { Context } from "effect";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type { EngineRpcClient } from "@guerillaglass/engine/protocol/rpc/group";
import type { EngineRpcError } from "@guerillaglass/engine/protocol/rpc/errors";

/** Errors that can be raised by the native engine RPC client. */
export type EngineTransportError = EngineRpcError | RpcClientError;

/** Effect RPC client service shape generated from the Guerillaglass engine RPC group. */
export type EngineTransportService = EngineRpcClient;

/**
 * Effect service tag for the Guerillaglass native engine client.
 *
 * Application code should depend on this service rather than constructing
 * transports directly. Platform-specific modules, such as `client/liveBun`,
 * provide the service with the appropriate native process and socket runtime.
 */
export class EngineTransport extends Context.Service<EngineTransport, EngineTransportService>()(
  "@guerillaglass/engine/EngineTransport",
) {}
