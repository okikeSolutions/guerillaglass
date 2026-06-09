import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import {
  EngineClient,
  type ProjectOpenRequest,
  type ProjectSaveRequest,
} from "../service";

/**
 * Domain service for project state operations.
 */
export type ProjectServiceShape = {
  /**
   * Reads the current project state.
   */
  readonly current: Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Opens a project from disk.
   */
  readonly open: (request: ProjectOpenRequest) => Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Saves current project state.
   */
  readonly save: (request: ProjectSaveRequest) => Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Lists recent projects.
   */
  readonly recents: (limit?: number) => Effect.Effect<ProjectRecentsResult, EngineClientError>;
};

/**
 * Effect service tag for project-domain engine operations.
 */
export class ProjectService extends Context.Service<ProjectService, ProjectServiceShape>()(
  "@guerillaglass/engine-client/ProjectService",
) {}

/**
 * Layer deriving project-domain operations from {@link EngineClient}.
 */
export const layerProjectService: Layer.Layer<ProjectService, never, EngineClient> = Layer.effect(
  ProjectService,
  Effect.map(EngineClient, (client) =>
    ProjectService.of({
      current: client.projectCurrent,
      open: client.projectOpen,
      save: client.projectSave,
      recents: client.projectRecents,
    }),
  ),
);
