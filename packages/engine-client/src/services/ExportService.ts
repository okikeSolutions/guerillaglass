import type {
  ExportInfoResult,
  ExportRunCutPlanResult,
  ExportRunResult,
} from "@guerillaglass/engine-contract/domains/export";
import type { ExportJobId } from "@guerillaglass/engine-contract/schema-primitives";
import { Context, Effect, Layer } from "effect";
import type { EngineClientFailure } from "../errors";
import { EngineClient, type ExportRunCutPlanRequest, type ExportRunRequest } from "../service";

/**
 * Domain service for render export operations.
 */
export type ExportServiceShape = {
  /**
   * Reads available export presets and capabilities.
   */
  readonly info: Effect.Effect<ExportInfoResult, EngineClientFailure>;
  /**
   * Starts a standard export job.
   */
  readonly run: (request: ExportRunRequest) => Effect.Effect<ExportRunResult, EngineClientFailure>;
  /**
   * Starts an export job from an Agent Mode cut plan.
   */
  readonly runCutPlan: (
    request: ExportRunCutPlanRequest,
  ) => Effect.Effect<ExportRunCutPlanResult, EngineClientFailure>;
  /**
   * Polls an export job.
   */
  readonly get: (jobId: ExportJobId) => Effect.Effect<ExportRunResult, EngineClientFailure>;
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
  Effect.gen(function* () {
    const client = yield* EngineClient;
    return ExportService.of({
      info: client.exportInfo,
      run: Effect.fn("ExportService.run")((request: ExportRunRequest) => client.exportRun(request)),
      runCutPlan: Effect.fn("ExportService.runCutPlan")((request: ExportRunCutPlanRequest) =>
        client.exportRunCutPlan(request),
      ),
      get: Effect.fn("ExportService.get")((jobId: ExportJobId) => client.exportGet(jobId)),
    });
  }),
);
