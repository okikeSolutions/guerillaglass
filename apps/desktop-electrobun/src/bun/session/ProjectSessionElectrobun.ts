import { Effect, FileSystem, Layer, Option, Ref, Schema } from "effect";
import { Utils } from "electrobun/bun";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import {
  projectStateSchema,
  type ProjectRecentsResult,
  type ProjectState,
} from "@guerillaglass/engine/protocol/domains/project";
import { pickPathForModeEffect } from "../path/picker";
import { readAllowedTextFile, resolveAllowedMediaFilePath } from "../security/fileAccess";
import type { BridgeRequests, HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";
import { PathPickerError } from "../../shared/errors/desktopErrors";
import { ProjectSession } from "./ProjectSession";

function projectPathFromState(projectState: unknown): string | null {
  const projectPath = (projectState as { readonly projectPath?: unknown }).projectPath;
  if (typeof projectPath === "string") {
    return projectPath;
  }
  if (projectPath === null || projectPath === undefined) {
    return null;
  }
  if (Option.isOption(projectPath)) {
    return Option.getOrNull(projectPath as Option.Option<string>);
  }
  return null;
}

function encodeProjectStateEffect(projectState: unknown) {
  return Schema.encodeUnknownEffect(Schema.toCodecJson(projectStateSchema))(projectState).pipe(
    Effect.map((encodedProjectState) => encodedProjectState as ProjectState),
  );
}

function updateCurrentProjectPathFromState(
  currentProjectPathRef: Ref.Ref<Option.Option<string>>,
  projectState: unknown,
) {
  const projectPath = projectPathFromState(projectState);
  return Ref.set(
    currentProjectPathRef,
    projectPath === null ? Option.none() : Option.some(projectPath),
  );
}

export const layerProjectSession = Layer.effect(
  ProjectSession,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const currentProjectPathRef = yield* Ref.make(Option.none<string>());

    const currentProjectPath = Effect.map(Ref.get(currentProjectPathRef), Option.getOrNull);

    const setCurrentProjectPath = (projectPath: string | null) =>
      Ref.set(
        currentProjectPathRef,
        projectPath === null ? Option.none() : Option.some(projectPath),
      );

    const projectCurrent = Effect.gen(function* () {
      const transport = yield* EngineTransport;
      const projectState = yield* transport["project.current"](undefined);
      yield* updateCurrentProjectPathFromState(currentProjectPathRef, projectState);
      return yield* encodeProjectStateEffect(projectState);
    });

    const projectOpen = (params: BridgeRequests["ggEngineProjectOpen"]["params"]) =>
      Effect.gen(function* () {
        const transport = yield* EngineTransport;
        const projectState = yield* transport["project.open"](params);
        yield* updateCurrentProjectPathFromState(currentProjectPathRef, projectState);
        return yield* encodeProjectStateEffect(projectState);
      });

    const projectSave = (params: BridgeRequests["ggEngineProjectSave"]["params"]) =>
      Effect.gen(function* () {
        const transport = yield* EngineTransport;
        const projectState = yield* transport["project.save"](params);
        yield* updateCurrentProjectPathFromState(currentProjectPathRef, projectState);
        return yield* encodeProjectStateEffect(projectState);
      });

    const projectRecents = (params: BridgeRequests["ggEngineProjectRecents"]["params"]) =>
      Effect.gen(function* () {
        const transport = yield* EngineTransport;
        return yield* transport["project.recents"](params);
      }) as Effect.Effect<ProjectRecentsResult, unknown, EngineTransport>;

    const loadInitialProject = projectCurrent.pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          console.warn("Failed to load initial project state for file-access policy", error);
        }),
      ),
      Effect.asVoid,
    );

    const pickPath = (params: { mode: HostPathPickerMode; startingFolder?: string }) =>
      Effect.gen(function* () {
        const defaultPickerFolder = Utils.paths.videos ?? Utils.paths.documents;
        const currentProjectPathForPicker = Option.getOrNull(yield* Ref.get(currentProjectPathRef));
        return yield* pickPathForModeEffect(params.mode, {
          currentProjectPath: currentProjectPathForPicker,
          startingFolder: params.startingFolder,
          defaultFolder: defaultPickerFolder,
          openFileDialog: (dialogOptions) =>
            Effect.tryPromise({
              try: () => Utils.openFileDialog(dialogOptions),
              catch: (error) =>
                new PathPickerError({
                  code: "PATH_PICKER_OPEN_DIALOG_FAILED",
                  description: "Open dialog failed.",
                  cause: error,
                }),
            }),
          pathExists: (filePath) => fs.exists(filePath).pipe(Effect.catch(() => Effect.succeed(false))),
          confirmOverwritePath: (filePath) =>
            Effect.tryPromise({
              try: () =>
                Utils.showMessageBox({
                  type: "question",
                  title: "Replace Project?",
                  message: "A project already exists at this location.",
                  detail: filePath,
                  buttons: ["Replace", "Cancel"],
                  defaultId: 1,
                  cancelId: 1,
                }),
              catch: (error) =>
                new PathPickerError({
                  code: "PATH_PICKER_OPEN_DIALOG_FAILED",
                  description: "Overwrite confirmation failed.",
                  cause: error,
                }),
            }).pipe(Effect.map((result) => result.response === 0)),
        });
      });

    const readTextFile = (filePath: string) =>
      Effect.gen(function* () {
        const currentProjectPathForAccess = Option.getOrNull(yield* Ref.get(currentProjectPathRef));
        return yield* Effect.tryPromise(() =>
          readAllowedTextFile(filePath, {
            currentProjectPath: currentProjectPathForAccess,
            tempDirectory: process.env.TMPDIR,
          }),
        ).pipe(Effect.map((contents) => contents as string));
      });

    const resolveProjectMediaFilePath = (filePath: string) =>
      Effect.gen(function* () {
        const currentProjectPathForAccess = Option.getOrNull(yield* Ref.get(currentProjectPathRef));
        return yield* Effect.sync(() =>
          resolveAllowedMediaFilePath(filePath, {
            currentProjectPath: currentProjectPathForAccess,
            tempDirectory: process.env.TMPDIR,
          }),
        );
      });

    return ProjectSession.of({
      currentProjectPath,
      setCurrentProjectPath,
      loadInitialProject,
      projectCurrent,
      projectOpen,
      projectSave,
      projectRecents,
      pickPath,
      readTextFile,
      resolveAllowedMediaFilePath: resolveProjectMediaFilePath,
    });
  }),
);
