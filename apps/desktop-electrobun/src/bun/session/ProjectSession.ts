import { Context, Effect } from "effect";
import type { EngineTransport } from "@guerillaglass/engine/client/service";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine/protocol/domains/project";
import type { BridgeRequests, HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";

type ProjectSessionService = {
  currentProjectPath: Effect.Effect<string | null>;
  setCurrentProjectPath: (projectPath: string | null) => Effect.Effect<void>;
  loadInitialProject: Effect.Effect<void, never, EngineTransport>;
  projectCurrent: Effect.Effect<ProjectState, unknown, EngineTransport>;
  projectOpen: (
    params: BridgeRequests["ggEngineProjectOpen"]["params"],
  ) => Effect.Effect<ProjectState, unknown, EngineTransport>;
  projectSave: (
    params: BridgeRequests["ggEngineProjectSave"]["params"],
  ) => Effect.Effect<ProjectState, unknown, EngineTransport>;
  projectRecents: (
    params: BridgeRequests["ggEngineProjectRecents"]["params"],
  ) => Effect.Effect<ProjectRecentsResult, unknown, EngineTransport>;
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
