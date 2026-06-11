import type { CapabilitiesResult, PingResult } from "@guerillaglass/engine-contract/domains/system";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import { EngineClient } from "../service";

/**
 * Domain service for engine health and capability endpoints.
 */
export type SystemServiceShape = {
  /**
   * Reads current engine health and protocol identity.
   */
  readonly ping: Effect.Effect<PingResult, EngineClientError>;
  /**
   * Reads the engine feature matrix.
   */
  readonly capabilities: Effect.Effect<CapabilitiesResult, EngineClientError>;
};

/**
 * Effect service tag for system-domain engine operations.
 */
export class SystemService extends Context.Service<SystemService, SystemServiceShape>()(
  "@guerillaglass/engine-client/SystemService",
) {}

/**
 * Layer deriving system-domain operations from {@link EngineClient}.
 */
export const layerSystemService: Layer.Layer<SystemService, never, EngineClient> = Layer.effect(
  SystemService,
  Effect.map(EngineClient, (client) =>
    SystemService.of({
      ping: client.systemPing,
      capabilities: client.engineCapabilities,
    }),
  ),
);
