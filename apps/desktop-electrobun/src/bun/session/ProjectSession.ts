import type { EngineClientFailure } from "@guerillaglass/engine-client/errors";
import type { FileAccessPolicyError, PathPickerError } from "../../shared/errors/desktopErrors";
import { Context, Effect, type Config, type Schema } from "effect";
import type { ProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import type { BridgeRequests, HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";

type ProjectSessionService = {
  currentProjectPath: Effect.Effect<string | null>;
  setCurrentProjectPath: (projectPath: string | null) => Effect.Effect<void>;
  loadInitialProject: Effect.Effect<void, never, ProjectService>;
  projectCurrent: Effect.Effect<
    ProjectState,
    EngineClientFailure | Schema.SchemaError,
    ProjectService
  >;
  projectOpen: (
    params: BridgeRequests["ggEngineProjectOpen"]["params"],
  ) => Effect.Effect<ProjectState, EngineClientFailure | Schema.SchemaError, ProjectService>;
  projectSave: (
    params: BridgeRequests["ggEngineProjectSave"]["params"],
  ) => Effect.Effect<ProjectState, EngineClientFailure | Schema.SchemaError, ProjectService>;
  projectRecents: (
    params: BridgeRequests["ggEngineProjectRecents"]["params"],
  ) => Effect.Effect<ProjectRecentsResult, EngineClientFailure, ProjectService>;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Effect.Effect<string | null, PathPickerError>;
  readTextFile: (
    filePath: string,
  ) => Effect.Effect<string, FileAccessPolicyError | Config.ConfigError>;
  resolveAllowedMediaFilePath: (
    filePath: string,
  ) => Effect.Effect<string, FileAccessPolicyError | Config.ConfigError>;
};

export class ProjectSession extends Context.Service<ProjectSession, ProjectSessionService>()(
  "@guerillaglass/desktop/ProjectSession",
) {}
