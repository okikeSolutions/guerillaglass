import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import { Context, Effect, Layer } from "effect";
import type { EngineClientFailure } from "../errors";
import { EngineClient, type ProjectOpenRequest, type ProjectSaveRequest } from "../service";

/**
 * Domain service for project state operations.
 */
export type ProjectServiceShape = {
  /**
   * Reads the current project state.
   */
  readonly current: Effect.Effect<ProjectState, EngineClientFailure>;
  /**
   * Opens a project from disk.
   */
  readonly open: (request: ProjectOpenRequest) => Effect.Effect<ProjectState, EngineClientFailure>;
  /**
   * Saves current project state.
   */
  readonly save: (request: ProjectSaveRequest) => Effect.Effect<ProjectState, EngineClientFailure>;
  /**
   * Lists recent projects.
   */
  readonly recents: (limit?: number) => Effect.Effect<ProjectRecentsResult, EngineClientFailure>;
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
  Effect.gen(function* () {
    const client = yield* EngineClient;
    return ProjectService.of({
      current: client.projectCurrent,
      open: Effect.fn("ProjectService.open")((request: ProjectOpenRequest) =>
        client.projectOpen(request),
      ),
      save: Effect.fn("ProjectService.save")((request: ProjectSaveRequest) =>
        client.projectSave(request),
      ),
      recents: Effect.fn("ProjectService.recents")((limit?: number) =>
        client.projectRecents(limit),
      ),
    });
  }),
);
