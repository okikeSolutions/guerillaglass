import type { CapabilitiesResult, PingResult } from "@guerillaglass/engine-contract/domains/system";
import { Context, Effect, Layer } from "effect";
import type { EngineClientFailure } from "../errors";
import { EngineClient } from "../service";

/**
 * Domain service for engine health and capability endpoints.
 */
export type SystemServiceShape = {
  /**
   * Reads current engine health and protocol identity.
   */
  readonly ping: Effect.Effect<PingResult, EngineClientFailure>;
  /**
   * Reads the engine feature matrix.
   */
  readonly capabilities: Effect.Effect<CapabilitiesResult, EngineClientFailure>;
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
  Effect.gen(function* () {
    const client = yield* EngineClient;
    return SystemService.of({
      ping: client.systemPing,
      capabilities: client.engineCapabilities,
    });
  }),
);
