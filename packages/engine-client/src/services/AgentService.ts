import type {
  AgentPreflightResult,
  AgentRunResult,
  AgentStatusResult,
} from "@guerillaglass/engine-contract/domains/agent";
import type { ActionResult } from "@guerillaglass/engine-contract/domains/permissions";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
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
  ) => Effect.Effect<AgentPreflightResult, EngineClientError>;
  /**
   * Starts an Agent Mode job.
   */
  readonly run: (request: AgentRunRequest) => Effect.Effect<AgentRunResult, EngineClientError>;
  /**
   * Polls Agent Mode job status.
   */
  readonly status: (jobId: string) => Effect.Effect<AgentStatusResult, EngineClientError>;
  /**
   * Applies Agent Mode job output to the current project.
   */
  readonly apply: (
    jobId: string,
    request: AgentApplyRequest,
  ) => Effect.Effect<ActionResult, EngineClientError>;
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
  Effect.map(EngineClient, (client) =>
    AgentService.of({
      preflight: client.agentPreflight,
      run: client.agentRun,
      status: client.agentStatus,
      apply: client.agentApply,
    }),
  ),
);
