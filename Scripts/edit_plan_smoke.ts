#!/usr/bin/env bun
import * as NodeRuntime from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeRuntime.js";
import * as NodeServices from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeServices.js";
import {
  Effect,
  FileSystem,
  Path,
  Schema,
  Stream,
} from "../apps/desktop-electrobun/node_modules/effect/dist/index.js";
import * as ChildProcess from "../apps/desktop-electrobun/node_modules/effect/dist/process/ChildProcess.js";
import { EngineClient, layerEngineClientBun } from "../packages/engine-client/src/service";
import { EngineResponseError } from "../packages/engine-client/src/errors";
import { editRevisionSchema, EditPlan } from "../packages/engine-contract/src/domains/editPlan";
import {
  projectPathSchema,
  timelineSegmentIdSchema,
} from "../packages/engine-contract/src/schema-primitives";

class EditSmokeError extends Schema.TaggedError<EditSmokeError>()("EditSmokeError", {
  message: Schema.String,
}) {}
const check = Effect.fn("EditSmoke.check")(function* (valid: boolean, message: string) {
  if (!valid) {
    return yield* new EditSmokeError({ message });
  }
});
const fixture = Effect.fn("EditSmoke.fixture")(function* (args: readonly string[]) {
  const child = yield* ChildProcess.make("swift", ["Scripts/macos_agent_fixture.swift", ...args], {
    stdin: "ignore",
    stderr: "inherit",
  });
  const output = yield* child.stdout.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (text, part) => text + part,
    ),
  );
  yield* check((yield* child.exitCode) === 0, "Media fixture failed");
  return output;
}, Effect.scoped);

const MediaProbe = Schema.Struct({
  durationSeconds: Schema.Number,
  hasVideo: Schema.Boolean,
  sampleColors: Schema.Array(Schema.Array(Schema.Number)),
});
const probeExport = Effect.fn("EditSmoke.probeExport")(function* (output: string, times: string) {
  return yield* Schema.decodeEffect(Schema.fromJsonString(MediaProbe))(
    yield* fixture(["--probe", output, times]),
  );
});

const workflow = Effect.fn("EditSmoke.workflow")(function* (directory: string) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const client = yield* EngineClient;
  const projectPath = yield* Schema.decodeUnknownEffect(projectPathSchema)(
    path.join(directory, "Demo.gglassproj"),
  );
  yield* client.projectOpen({ projectPath });
  yield* fixture(["--patterned", path.join(projectPath, "recording.mov")]);
  const projectFile = path.join(projectPath, "project.json");
  const document = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
  )(yield* fs.readFileString(projectFile));
  yield* fs.writeFileString(
    projectFile,
    JSON.stringify({ ...document, eventsFileName: "events.json" }),
  );
  const eventsFile = path.join(projectPath, "events.json");
  yield* fs.writeFileString(eventsFile, JSON.stringify({ schemaVersion: 1, events: [] }));
  yield* client.projectOpen({ projectPath });
  yield* client.projectSave({
    autoZoom: { isEnabled: false, intensity: 1, minimumKeyframeInterval: 0.1 },
  });
  const competitor = yield* ChildProcess.make(
    "bun",
    ["Scripts/edit_project.ts", "review", projectPath],
    { stdin: "ignore", stderr: "ignore" },
  );
  const competitorOutput = yield* competitor.stdout.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (text, part) => text + part,
    ),
  );
  yield* check(
    (yield* competitor.exitCode) !== 0 && competitorOutput.includes("project_busy"),
    "A competing adapter must fail without terminating the owner",
  );
  const review = yield* client.editReview;
  const plan = yield* Schema.decodeUnknownEffect(EditPlan)({
    version: 1,
    id: "storyboard-1",
    baseRevision: review.revision,
    sourceRevision: review.sourceRevision,
    timeline: {
      version: 2,
      items: [
        {
          kind: "clip",
          id: "result",
          sourceAssetId: "recording",
          sourceStartSeconds: 6,
          sourceEndSeconds: 7,
          camera: [{ timeSeconds: 6, centerX: 0.25, centerY: 0.5, zoom: 2 }],
        },
        { kind: "gap", id: "pause", durationSeconds: 0.5 },
        {
          kind: "clip",
          id: "setup",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
          camera: [{ timeSeconds: 0, centerX: 0.75, centerY: 0.5, zoom: 2 }],
        },
        {
          kind: "clip",
          id: "repeat",
          sourceAssetId: "recording",
          sourceStartSeconds: 6,
          sourceEndSeconds: 7,
          camera: [{ timeSeconds: 6, centerX: 0.75, centerY: 0.5, zoom: 2 }],
        },
      ],
    },
  });
  yield* client.editValidate(plan);
  yield* fs.writeFileString(
    eventsFile,
    JSON.stringify({
      schemaVersion: 1,
      events: [{ type: "mouseDown", timestamp: 1, position: { x: 10, y: 20 }, button: "left" }],
    }),
  );
  const changedEvents = yield* client.editValidate(plan).pipe(
    Effect.match({
      onSuccess: () => false,
      onFailure: (error) =>
        error instanceof EngineResponseError && error.code === "project_mismatch",
    }),
  );
  yield* check(changedEvents, "Changed capture events did not invalidate the project revision");
  yield* fs.writeFileString(eventsFile, JSON.stringify({ schemaVersion: 1, events: [] }));
  const wrongSource = yield* client
    .editValidate({ ...plan, sourceRevision: editRevisionSchema.make("0".repeat(64)) })
    .pipe(
      Effect.match({
        onSuccess: () => false,
        onFailure: (error) =>
          error instanceof EngineResponseError && error.code === "project_mismatch",
      }),
    );
  yield* check(wrongSource, "Source revision mismatch was not rejected");
  const invalid = {
    ...plan,
    timeline: {
      version: 2 as const,
      items: [
        {
          kind: "clip" as const,
          id: timelineSegmentIdSchema.make("invalid-scene"),
          sourceAssetId: "recording" as const,
          sourceStartSeconds: 0,
          sourceEndSeconds: review.sourceDurationSeconds + 1,
        },
      ],
    },
  };
  const invalidRejected = yield* client.editValidate(invalid).pipe(
    Effect.match({
      onSuccess: () => false,
      onFailure: (error) => error instanceof EngineResponseError && error.code === "invalid_params",
    }),
  );
  yield* check(invalidRejected, "Out-of-source plan was accepted");
  const presets = yield* client.exportInfo;
  const preset = presets.presets.find((item) => item.fileType === "mp4");
  if (!preset) {
    return yield* new EditSmokeError({ message: "No MP4 export preset" });
  }
  const applied = yield* client.editApply(plan);
  const gapOutput = path.join(directory, "with-gap.mp4");
  yield* client.editExport({
    expectedRevision: applied.revision,
    presetId: preset.id,
    outputURL: yield* Schema.decodeUnknownEffect(EditExportRequestOutput)(gapOutput),
  });
  const gapProbe = yield* probeExport(gapOutput, "0.5,1.25,1.75,2.75");
  const blackGap = gapProbe.sampleColors[1];
  yield* check(
    Math.abs(gapProbe.durationSeconds - 3.5) < 0.05 &&
      blackGap?.length === 3 &&
      blackGap.every((channel) => channel < 15),
    "Initial edit did not render its black gap",
  );
  yield* check(applied.revision !== review.revision, "Apply did not advance the editing revision");
  const stale = yield* client.editApply(plan).pipe(
    Effect.match({
      onSuccess: () => false,
      onFailure: (error) =>
        error instanceof EngineResponseError && error.code === "project_mismatch",
    }),
  );
  yield* check(stale, "Stale edit was not rejected");
  yield* client.projectOpen({ projectPath });
  const reopened = yield* client.editReview;
  yield* check(reopened.revision === applied.revision, "Revision changed on reopen");
  const revised = yield* client.editApply({
    ...plan,
    baseRevision: reopened.revision,
    timeline: {
      ...plan.timeline,
      items: plan.timeline.items.filter((item) => item.id !== "pause"),
    },
  });
  yield* check(
    revised.project.timeline.items.map((item) => item.id).join(",") === "result,setup,repeat",
    "Revision lost scene identity",
  );
  const staleExport = yield* client
    .editExport({
      expectedRevision: applied.revision,
      presetId: preset.id,
      outputURL: yield* Schema.decodeUnknownEffect(EditExportRequestOutput)(
        path.join(directory, "stale.mp4"),
      ),
    })
    .pipe(
      Effect.match({
        onSuccess: () => false,
        onFailure: (error) =>
          error instanceof EngineResponseError && error.code === "project_mismatch",
      }),
    );
  yield* check(staleExport, "Stale export was not rejected");
  const outputURL = path.join(directory, "edited.mp4");
  const exported = yield* client.editExport({
    expectedRevision: revised.revision,
    presetId: preset.id,
    outputURL: yield* Schema.decodeUnknownEffect(EditExportRequestOutput)(outputURL),
  });
  yield* check(
    (yield* client.exportGet(exported.jobId)).status === "succeeded",
    "Export job cannot be inspected",
  );
  const probe = yield* probeExport(outputURL, "0.5,1.5,2.5");
  yield* check(
    probe.hasVideo && Math.abs(probe.durationSeconds - 3) < 0.05,
    "Export did not render the revised timeline",
  );
  const firstColor = probe.sampleColors[0];
  const secondColor = probe.sampleColors[1];
  const repeatedColor = probe.sampleColors[2];
  yield* check(
    (firstColor?.[0] ?? 0) > 150 &&
      (firstColor?.[2] ?? 255) < 100 &&
      (secondColor?.[2] ?? 0) > 150 &&
      (secondColor?.[0] ?? 255) < 100 &&
      (repeatedColor?.[2] ?? 0) > 150 &&
      (repeatedColor?.[0] ?? 255) < 100,
    "Scene camera overrides did not survive persistence and native rendering",
  );
  console.log(
    JSON.stringify({
      success: true,
      revisedSceneIds: revised.project.timeline.items.map((item) => item.id),
      durationSeconds: probe.durationSeconds,
      gapDurationSeconds: gapProbe.durationSeconds,
      sourceMismatchRejected: wrongSource,
      staleExportRejected: staleExport,
    }),
  );
});
// Reuse the contract brand at this script boundary.
import { outputUrlSchema as EditExportRequestOutput } from "../packages/engine-contract/src/schema-primitives";
const main = Effect.fn("EditSmoke.main")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "gg-edit-smoke-" });
  yield* workflow(yield* fs.realPath(directory)).pipe(
    Effect.provide(
      layerEngineClientBun({
        enginePath: path.resolve(".build/debug/guerillaglass-engine"),
        cleanupStaleProcesses: false,
      }),
    ),
  );
}, Effect.scoped);
NodeRuntime.runMain(main().pipe(Effect.provide(NodeServices.layer)));
