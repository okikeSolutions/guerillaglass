import type { SourcesResult } from "@guerillaglass/engine-contract/domains/sources";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import { EngineClient } from "../service";

/**
 * Domain service for capturable source discovery.
 */
export type SourcesServiceShape = {
  /**
   * Lists capturable displays and windows.
   */
  readonly list: Effect.Effect<SourcesResult, EngineClientError>;
};

/**
 * Effect service tag for source-domain engine operations.
 */
export class SourcesService extends Context.Service<SourcesService, SourcesServiceShape>()(
  "@guerillaglass/engine-client/SourcesService",
) {}

/**
 * Layer deriving source-domain operations from {@link EngineClient}.
 */
export const layerSourcesService: Layer.Layer<SourcesService, never, EngineClient> = Layer.effect(
  SourcesService,
  Effect.map(EngineClient, (client) => SourcesService.of({ list: client.sourcesList })),
);
