#!/usr/bin/env bun
import * as SecureRandom from "../apps/desktop-electrobun/node_modules/effect/dist/crypto/SecureRandom.js";
import * as NodeRuntime from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeRuntime.js";
import * as NodeServices from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeServices.js";
import {
  Config,
  Effect,
  FileSystem,
  Logger,
  Path,
  Schema,
} from "../apps/desktop-electrobun/node_modules/effect/dist/index.js";
import * as ChildProcess from "../apps/desktop-electrobun/node_modules/effect/dist/process/ChildProcess.js";
import { EditReview, EditExportRequest } from "../packages/engine-contract/src/domains/editPlan";
import {
  EditStoryboard,
  EditRenderReview,
  compileStoryboard,
  describeSceneChanges,
  materializeReviewTimeline,
  EditRenderReceipt,
  EditRenderReviewBinding,
} from "../packages/engine-contract/src/domains/editWorkflow";
import { projectPathSchema } from "../packages/engine-contract/src/schema-primitives";
import { EngineClient, layerEngineClientBun } from "../packages/engine-client/src/service";
import {
  EditCommand,
  EditAdapterError,
  runSavedProjectCommand,
} from "../packages/engine-client/src/editing";

const readJson = <S extends Schema.Top>(schema: S, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if ((yield* fs.stat(file)).size > 2 * 1024 * 1024) {
      return yield* new EditAdapterError({ message: "Workflow input exceeds 2 MiB." });
    }
    return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(
      yield* fs.readFileString(file),
    );
  });
const writeJson = Effect.fn("AgentWorkflow.writeJson")(function* (file: string, value: unknown) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
});
const check = Effect.fn("AgentWorkflow.check")(function* (condition: boolean, message: string) {
  if (!condition) {
    return yield* new EditAdapterError({ message });
  }
});

const createWorkspace = Effect.fn("AgentWorkflow.createWorkspace")(function* (
  argument: string,
  project?: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(argument);
  const parent = yield* fs.realPath(path.dirname(resolved));
  const destination = path.join(parent, path.basename(resolved));
  if (project) {
    const source = yield* fs.realPath(project);
    yield* check(
      destination !== source && !destination.startsWith(source + path.sep),
      "Keep the workflow workspace outside the project package.",
    );
  }
  // Existing workspaces are evidence. A new pass gets a new directory.
  yield* fs.makeDirectory(destination);
  return destination;
});

const extractFrame = Effect.fn("AgentWorkflow.extractFrame")(function* (
  source: string,
  destination: string,
  seconds: number,
) {
  const ffmpeg = yield* Config.String("GG_FFMPEG_PATH").pipe(Config.withDefault("ffmpeg"));
  const child = yield* ChildProcess.make(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-n",
      "-ss",
      seconds.toFixed(6),
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-2",
      "-update",
      "1",
      destination,
    ],
    { stdin: "ignore", stdout: "ignore", stderr: "inherit" },
  );
  yield* check(
    (yield* child.exitCode) === 0,
    "Frame extraction failed. Install ffmpeg or configure GG_FFMPEG_PATH.",
  );
  const fs = yield* FileSystem.FileSystem;
  yield* check(yield* fs.exists(destination), "The requested frame could not be decoded.");
}, Effect.scoped);

const makeFrames = Effect.fn("AgentWorkflow.makeFrames")(function* (
  source: string,
  directory: string,
  times: readonly { seconds: number; sceneId?: string }[],
) {
  const path = yield* Path.Path;
  const samples = [];
  for (const [index, sample] of times.entries()) {
    const file = `frame-${String(index + 1).padStart(3, "0")}.jpg`;
    yield* extractFrame(source, path.join(directory, file), sample.seconds);
    samples.push({ ...sample, file });
  }
  yield* writeJson(path.join(directory, "frames.json"), { samples });
  return samples;
});

const main = Effect.fn("AgentWorkflow.main")(function* () {
  const [operation, first, second, third, ...extra] = process.argv.slice(2);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (
    !first ||
    !second ||
    extra.length ||
    !["prepare", "propose", "render", "record-review"].includes(operation ?? "") ||
    (operation === "record-review" ? Boolean(third) : !third)
  ) {
    return yield* new EditAdapterError({
      message:
        "Usage: agent:workflow prepare <project> <brief.md> <new-workspace> | propose <project> <storyboard.json> <new-workspace> | render <project> <new-workspace> <preset-id> | record-review <render-workspace> <feedback.json>. Close the desktop before project commands.",
    });
  }
  if (operation === "record-review") {
    const directory = path.resolve(first);
    const receipt = yield* readJson(EditRenderReceipt, path.join(directory, "render.json"));
    const feedback = yield* readJson(EditRenderReview, path.resolve(second));
    yield* Schema.decodeUnknownEffect(EditRenderReviewBinding)({
      render: receipt,
      review: feedback,
    });
    yield* writeJson(path.join(directory, "feedback.json"), feedback);
    return { workspace: directory, verdict: feedback.verdict, revision: feedback.revision };
  }
  const project = yield* Schema.decodeUnknownEffect(projectPathSchema)(path.resolve(first));
  const enginePath = yield* Config.String("GG_ENGINE_PATH").pipe(
    Config.withDefault(path.resolve(".build/debug/guerillaglass-engine")),
  );
  return yield* Effect.gen(function* () {
    const snapshot = yield* runSavedProjectCommand(project, EditCommand.Review()).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(EditReview)),
    );
    const client = yield* EngineClient;
    if (operation === "prepare") {
      const briefFile = path.resolve(second);
      yield* check((yield* fs.stat(briefFile)).size <= 20_000, "Brief exceeds 20,000 bytes.");
      const brief = yield* fs.readFileString(briefFile);
      yield* check(brief.trim().length > 0, "A creative or revision brief is required.");
      yield* check(
        Boolean(snapshot.project.recordingURL) && snapshot.sourceDurationSeconds > 0,
        "Project has no source recording.",
      );
      const directory = yield* createWorkspace(third ?? "", project);
      yield* writeJson(path.join(directory, "review.json"), snapshot);
      yield* fs.writeFileString(path.join(directory, "brief.md"), brief);
      yield* fs.writeFileString(
        path.join(directory, "storyboard-agent.md"),
        "Read .agents/skills/guerilla-editing/references/storyboard.md. Inspect review.json, brief.md, frames.json and source images. Write storyboard.json. Retain scene IDs when revising.\n",
      );
      const count = Math.min(12, Math.max(1, Math.ceil(snapshot.sourceDurationSeconds)));
      yield* makeFrames(
        snapshot.project.recordingURL ?? "",
        directory,
        Array.from({ length: count }, (_, index) => ({
          seconds: (snapshot.sourceDurationSeconds * (index + 0.5)) / count,
        })),
      );
      const after = yield* client.editReview;
      yield* check(
        after.revision === snapshot.revision,
        "Project changed while preparing source evidence. Discard this workspace and prepare again.",
      );
      return { workspace: directory, revision: snapshot.revision };
    }
    if (operation === "propose") {
      const storyboard = yield* readJson(EditStoryboard, path.resolve(second));
      const plan = compileStoryboard(storyboard);
      yield* client.editValidate(plan);
      const directory = yield* createWorkspace(third ?? "", project);
      yield* writeJson(path.join(directory, "storyboard.json"), storyboard);
      yield* writeJson(path.join(directory, "plan.json"), plan);
      yield* writeJson(
        path.join(directory, "changes.json"),
        describeSceneChanges(
          materializeReviewTimeline(snapshot.project.timeline, snapshot.sourceDurationSeconds),
          plan.timeline,
        ),
      );
      return { workspace: directory, validated: true, revision: snapshot.revision };
    }
    const presetId = third ?? "";
    const directory = yield* createWorkspace(second, project);
    const outputFile = path.join(directory, "render.mp4");
    const request = yield* Schema.decodeUnknownEffect(EditExportRequest)({
      expectedRevision: snapshot.revision,
      outputURL: outputFile,
      presetId,
    });
    yield* client.editExport(request);
    const crypto = yield* SecureRandom.SecureRandom;
    const renderId = yield* crypto.uuidV4();
    const timeline = snapshot.project.timeline.items.length
      ? snapshot.project.timeline.items
      : [
          {
            kind: "clip" as const,
            id: "full-source",
            sourceStartSeconds: 0,
            sourceEndSeconds: snapshot.sourceDurationSeconds,
          },
        ];
    let elapsed = 0;
    const times = timeline.map((item) => {
      const duration =
        item.kind === "gap"
          ? item.durationSeconds
          : item.sourceEndSeconds - item.sourceStartSeconds;
      const seconds = elapsed + duration / 2;
      elapsed += duration;
      return { seconds, sceneId: item.id };
    });
    yield* makeFrames(outputFile, directory, times.slice(0, 24));
    const receipt = yield* Schema.decodeUnknownEffect(EditRenderReceipt)({
      version: 1,
      snapshot,
      renderId,
      outputFile,
      programDurationSeconds: elapsed,
      sceneIds: times.map((sample) => sample.sceneId),
    });
    yield* writeJson(path.join(directory, "render.json"), receipt);
    yield* writeJson(path.join(directory, "review-template.json"), {
      version: 1,
      revision: snapshot.revision,
      renderId,
      verdict: "changes_requested",
      summary: "Inspect render.mp4 before completing this review.",
      findings: [],
    });
    yield* fs.writeFileString(
      path.join(directory, "reviewer.md"),
      `Inspect the full render.mp4 against the brief and storyboard. frames.json samples ${Math.min(times.length, 24)} of ${times.length} scenes. Write EditRenderReview feedback using retained scene IDs and record it with agent:workflow record-review. The template is deliberately incomplete and cannot be approved automatically.\n`,
    );
    return { workspace: directory, revision: snapshot.revision, outputFile };
  }).pipe(
    Effect.provide(layerEngineClientBun({ enginePath, cleanupStaleProcesses: false }, 600_000)),
  );
});

NodeRuntime.runMain(
  main().pipe(
    Effect.tap((result) => Effect.sync(() => console.log(JSON.stringify(result)))),
    Effect.catch((error) =>
      Effect.sync(() => {
        console.log(
          JSON.stringify({
            error: {
              type: error._tag,
              message: String(error.message),
              ...("code" in error ? { code: error.code } : {}),
            },
          }),
        );
        process.exitCode = 1;
      }),
    ),
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.provide(SecureRandom.layerWebCrypto),
    Effect.provide(Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)])),
  ),
);
