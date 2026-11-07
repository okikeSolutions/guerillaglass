#!/usr/bin/env bun
import * as NodeRuntime from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeRuntime.js";
import * as NodeServices from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeServices.js";
import { Config, Effect, FileSystem, Logger, Path, Schema } from "../apps/desktop-electrobun/node_modules/effect/dist/index.js";
import { EditPlan, EditExportRequest } from "../packages/engine-contract/src/domains/editPlan";
import { projectPathSchema } from "../packages/engine-contract/src/schema-primitives";
import { EditCommand, EditAdapterError, runSavedProjectCommand } from "../packages/engine-client/src/editing";
import { layerEngineClientBun } from "../packages/engine-client/src/service";

const main = Effect.fn("EditCLI.main")(function* () {
  const [operation, projectArgument, requestFile, ...extra] = process.argv.slice(2);
  if (!projectArgument || extra.length > 0 ||
      !["review", "validate", "apply", "export"].includes(operation ?? "") ||
      (operation === "review" ? requestFile !== undefined : !requestFile)) {
    return yield* new EditAdapterError({
      message: "Usage: bun run agent:edit <review|validate|apply|export> <saved-project> [request.json]. Close the desktop project first.",
    });
  }
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const projectPath = yield* Schema.decodeUnknownEffect(projectPathSchema)(path.resolve(projectArgument));
  let command: EditCommand = EditCommand.Review();
  if (requestFile) {
    const text = yield* fs.readFileString(path.resolve(requestFile));
    command = operation === "export"
      ? EditCommand.Export({ request: yield* Schema.decodeEffect(Schema.fromJsonString(EditExportRequest))(text) })
      : operation === "apply"
        ? EditCommand.Apply({ plan: yield* Schema.decodeEffect(Schema.fromJsonString(EditPlan))(text) })
        : EditCommand.Validate({ plan: yield* Schema.decodeEffect(Schema.fromJsonString(EditPlan))(text) });
  }
  const enginePath = yield* Config.String("GG_ENGINE_PATH").pipe(
    Config.withDefault(path.resolve(".build/debug/guerillaglass-engine")),
  );
  const result = yield* runSavedProjectCommand(projectPath, command).pipe(
    Effect.provide(layerEngineClientBun({ enginePath, cleanupStaleProcesses: false })),
  );
  console.log(JSON.stringify(result));
});

NodeRuntime.runMain(main().pipe(
  Effect.catch((error) => Effect.sync(() => {
    console.log(JSON.stringify({ error: {
      type: error._tag,
      message: "message" in error ? String(error.message) : "Unable to execute saved-project command.",
      ...("code" in error ? { code: error.code } : {}),
    } }));
    process.exitCode = 1;
  })),
  Effect.provide(NodeServices.layer),
  Effect.provide(Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)])),
));
