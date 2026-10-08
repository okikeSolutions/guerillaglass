import type {
  AgentApplyResult,
  AgentPreflightResult,
  AgentRunResult,
  AgentStatusResult,
} from "@guerillaglass/engine-contract/domains/agent";
import type { AgentJobId } from "@guerillaglass/engine-contract/schema-primitives";
import { Context, Effect, Layer } from "effect";
import type { EngineClientFailure } from "../errors";
import {
  EngineClient,
  type AgentApplyRequest,
  type AgentPreflightRequest,
  type AgentRunRequest,
} from "../service";

/**
 * Domain service for Agent Mode operations.
 */
export type AgentServiceShape = {
  /**
   * Checks whether Agent Mode can run for the current project.
   */
  readonly preflight: (
    request: AgentPreflightRequest,
  ) => Effect.Effect<AgentPreflightResult, EngineClientFailure>;
  /**
   * Starts an Agent Mode job.
   */
  readonly run: (request: AgentRunRequest) => Effect.Effect<AgentRunResult, EngineClientFailure>;
  /**
   * Polls Agent Mode job status.
   */
  readonly status: (jobId: AgentJobId) => Effect.Effect<AgentStatusResult, EngineClientFailure>;
  /**
   * Applies Agent Mode job output to the current project.
   */
  readonly apply: (
    jobId: AgentJobId,
    request: AgentApplyRequest,
  ) => Effect.Effect<AgentApplyResult, EngineClientFailure>;
};

/**
 * Effect service tag for Agent Mode engine operations.
 */
export class AgentService extends Context.Service<AgentService, AgentServiceShape>()(
  "@guerillaglass/engine-client/AgentService",
) {}

/**
 * Layer deriving Agent Mode operations from {@link EngineClient}.
 */
export const layerAgentService: Layer.Layer<AgentService, never, EngineClient> = Layer.effect(
  AgentService,
  Effect.gen(function* () {
    const client = yield* EngineClient;
    return AgentService.of({
      preflight: Effect.fn("AgentService.preflight")((request: AgentPreflightRequest) =>
        client.agentPreflight(request),
      ),
      run: Effect.fn("AgentService.run")((request: AgentRunRequest) => client.agentRun(request)),
      status: Effect.fn("AgentService.status")((jobId: AgentJobId) => client.agentStatus(jobId)),
      apply: Effect.fn("AgentService.apply")((jobId: AgentJobId, request: AgentApplyRequest) =>
        client.agentApply(jobId, request),
      ),
    });
  }),
);
