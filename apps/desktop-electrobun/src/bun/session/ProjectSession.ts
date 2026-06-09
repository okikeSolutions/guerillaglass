import { Context, Effect } from "effect";
import type { EngineClient } from "@guerillaglass/engine-client/service";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import type { BridgeRequests, HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";

type ProjectSessionService = {
  currentProjectPath: Effect.Effect<string | null>;
  setCurrentProjectPath: (projectPath: string | null) => Effect.Effect<void>;
  loadInitialProject: Effect.Effect<void, never, EngineClient>;
  projectCurrent: Effect.Effect<ProjectState, unknown, EngineClient>;
  projectOpen: (
    params: BridgeRequests["ggEngineProjectOpen"]["params"],
  ) => Effect.Effect<ProjectState, unknown, EngineClient>;
  projectSave: (
    params: BridgeRequests["ggEngineProjectSave"]["params"],
  ) => Effect.Effect<ProjectState, unknown, EngineClient>;
  projectRecents: (
    params: BridgeRequests["ggEngineProjectRecents"]["params"],
  ) => Effect.Effect<ProjectRecentsResult, unknown, EngineClient>;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Effect.Effect<string | null, unknown>;
  readTextFile: (filePath: string) => Effect.Effect<string, unknown>;
  resolveAllowedMediaFilePath: (filePath: string) => Effect.Effect<string, unknown>;
};

export class ProjectSession extends Context.Service<ProjectSession, ProjectSessionService>()(
  "@guerillaglass/desktop/ProjectSession",
) {}
