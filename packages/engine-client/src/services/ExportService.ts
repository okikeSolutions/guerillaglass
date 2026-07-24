import type {
  ExportInfoResult,
  ExportRunCutPlanResult,
  ExportRunResult,
} from "@guerillaglass/engine-contract/domains/export";
import type { ExportJobId } from "@guerillaglass/engine-contract/schema-primitives";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import { EngineClient, type ExportRunCutPlanRequest, type ExportRunRequest } from "../service";

/**
 * Domain service for render export operations.
 */
export type ExportServiceShape = {
  /**
   * Reads available export presets and capabilities.
   */
  readonly info: Effect.Effect<ExportInfoResult, EngineClientError>;
  /**
   * Starts a standard export job.
   */
  readonly run: (request: ExportRunRequest) => Effect.Effect<ExportRunResult, EngineClientError>;
  /**
   * Starts an export job from an Agent Mode cut plan.
   */
  readonly runCutPlan: (
    request: ExportRunCutPlanRequest,
  ) => Effect.Effect<ExportRunCutPlanResult, EngineClientError>;
  /**
   * Polls an export job.
   */
  readonly get: (jobId: ExportJobId) => Effect.Effect<ExportRunResult, EngineClientError>;
};

/**
 * Effect service tag for export-domain engine operations.
 */
export class ExportService extends Context.Service<ExportService, ExportServiceShape>()(
  "@guerillaglass/engine-client/ExportService",
) {}

/**
 * Layer deriving export-domain operations from {@link EngineClient}.
 */
export const layerExportService: Layer.Layer<ExportService, never, EngineClient> = Layer.effect(
  ExportService,
  Effect.map(EngineClient, (client) =>
    ExportService.of({
      info: client.exportInfo,
      run: client.exportRun,
      runCutPlan: client.exportRunCutPlan,
      get: client.exportGet,
    }),
  ),
);
