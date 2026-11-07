#!/usr/bin/env bun
import * as NodeRuntime from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeRuntime.js";
import * as NodeServices from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeServices.js";
import { Effect, FileSystem, Path, Schema, Stream } from "../apps/desktop-electrobun/node_modules/effect/dist/index.js";
import * as ChildProcess from "../apps/desktop-electrobun/node_modules/effect/dist/process/ChildProcess.js";
import { EngineClient, layerEngineClientBun } from "../packages/engine-client/src/service";
import { EngineResponseError } from "../packages/engine-client/src/errors";
import { EditPlan } from "../packages/engine-contract/src/domains/editPlan";
import { projectPathSchema } from "../packages/engine-contract/src/schema-primitives";

class EditSmokeError extends Schema.TaggedError<EditSmokeError>()("EditSmokeError", { message: Schema.String }) {}
const check = Effect.fn("EditSmoke.check")(function* (valid: boolean, message: string) {
  if (!valid) return yield* new EditSmokeError({ message });
});
const fixture = Effect.fn("EditSmoke.fixture")(function* (args: readonly string[]) {
  const child = yield* ChildProcess.make("swift", ["Scripts/macos_agent_fixture.swift", ...args], { stdin: "ignore", stderr: "inherit" });
  const output = yield* child.stdout.pipe(Stream.decodeText(), Stream.runFold(() => "", (text, part) => text + part));
  yield* check((yield* child.exitCode) === 0, "Media fixture failed");
  return output;
}, Effect.scoped);

const workflow = Effect.fn("EditSmoke.workflow")(function* (directory: string) {
  const path = yield* Path.Path;
  const client = yield* EngineClient;
  const projectPath = yield* Schema.decodeUnknownEffect(projectPathSchema)(path.join(directory, "Demo.gglassproj"));
  yield* client.projectOpen({ projectPath });
  yield* fixture([path.join(projectPath, "recording.mov")]);
  yield* client.projectOpen({ projectPath });
  yield* client.projectSave({ autoZoom: { isEnabled: false, intensity: 1, minimumKeyframeInterval: 0.1 } });
  const review = yield* client.editReview;
  const plan = yield* Schema.decodeUnknownEffect(EditPlan)({
    version: 1, id: "storyboard-1", baseRevision: review.revision, sourceRevision: review.sourceRevision,
    timeline: { version: 2, items: [
      { kind: "clip", id: "result", sourceAssetId: "recording", sourceStartSeconds: 6, sourceEndSeconds: 7 },
      { kind: "gap", id: "pause", durationSeconds: 0.5 },
      { kind: "clip", id: "setup", sourceAssetId: "recording", sourceStartSeconds: 0, sourceEndSeconds: 1 },
    ] },
  });
  yield* client.editValidate(plan);
  const applied = yield* client.editApply(plan);
  yield* check(applied.revision !== review.revision, "Apply did not advance the editing revision");
  const stale = yield* client.editApply(plan).pipe(Effect.match({ onSuccess: () => false, onFailure: (error) => error instanceof EngineResponseError && error.code === "project_mismatch" }));
  yield* check(stale, "Stale edit was not rejected");
  yield* client.projectOpen({ projectPath });
  const reopened = yield* client.editReview;
  yield* check(reopened.revision === applied.revision, "Revision changed on reopen");
  const revised = yield* client.editApply({ ...plan, baseRevision: reopened.revision,
    timeline: { ...plan.timeline, items: plan.timeline.items.filter((item) => item.id !== "pause") },
  });
  yield* check(revised.project.timeline.items.map((item) => item.id).join(",") === "result,setup", "Revision lost scene identity");
  const presets = yield* client.exportInfo;
  const preset = presets.presets.find((item) => item.fileType === "mp4");
  if (!preset) return yield* new EditSmokeError({ message: "No MP4 export preset" });
  const outputURL = path.join(directory, "edited.mp4");
  yield* client.editExport({ expectedRevision: revised.revision, presetId: preset.id, outputURL: yield* Schema.decodeUnknownEffect(EditExportRequestOutput)(outputURL) });
  const probe = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({ durationSeconds: Schema.Number, hasVideo: Schema.Boolean })))(yield* fixture(["--probe", outputURL]));
  yield* check(probe.hasVideo && Math.abs(probe.durationSeconds - 2) < 0.05, "Export did not render the revised timeline");
  console.log(JSON.stringify({ success: true, revisedSceneIds: revised.project.timeline.items.map((item) => item.id), durationSeconds: probe.durationSeconds }));
});
// Reuse the contract brand at this script boundary.
import { outputUrlSchema as EditExportRequestOutput } from "../packages/engine-contract/src/schema-primitives";
const main = Effect.fn("EditSmoke.main")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "gg-edit-smoke-" });
  yield* workflow(yield* fs.realPath(directory)).pipe(Effect.provide(layerEngineClientBun({
    enginePath: path.resolve(".build/debug/guerillaglass-engine"), cleanupStaleProcesses: false,
  })));
}, Effect.scoped);
NodeRuntime.runMain(main().pipe(Effect.provide(NodeServices.layer)));
