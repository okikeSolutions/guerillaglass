#!/usr/bin/env bun

import * as NodeRuntime from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeRuntime.js";
import * as NodeServices from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeServices.js";
import * as NodeHttpClient from "../apps/desktop-electrobun/node_modules/@effect/platform-node/dist/NodeHttpClient.js";
import {
  Effect,
  Exit,
  FileSystem,
  Path,
  Schema,
  Scope,
  Stream,
} from "../apps/desktop-electrobun/node_modules/effect/dist/index.js";
import * as HttpClient from "../apps/desktop-electrobun/node_modules/effect/dist/http/HttpClient.js";
import * as HttpClientRequest from "../apps/desktop-electrobun/node_modules/effect/dist/http/HttpClientRequest.js";
import * as ChildProcess from "../apps/desktop-electrobun/node_modules/effect/dist/process/ChildProcess.js";
import {
  makeEngineHttpProcess,
  type EngineHttpProcess,
} from "../packages/engine-client/src/process/launchBun";

class AgentSmokeError extends Schema.TaggedError<AgentSmokeError>()("AgentSmokeError", {
  message: Schema.String,
}) {}

const WireObject = Schema.Record(Schema.String, Schema.Unknown);
const readObject = Effect.fn("AgentSmoke.readObject")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Schema.decodeEffect(Schema.fromJsonString(WireObject))(
    yield* fs.readFileString(filePath),
  );
});
const request = Effect.fn("AgentSmoke.request")(function* (
  engine: EngineHttpProcess,
  urlPath: string,
  init: { readonly method?: "POST"; readonly body?: string } = {},
) {
  let wire = HttpClientRequest.make(init.method ?? "GET")(
    new URL(urlPath, engine.baseUrl).toString(),
  ).pipe(HttpClientRequest.bearerToken(engine.bearerToken));
  if (init.body !== undefined) {
    wire = wire.pipe(HttpClientRequest.bodyText(init.body, "application/json"));
  }
  const response = yield* HttpClient.execute(wire);
  const body = yield* Schema.decodeUnknownEffect(WireObject)(yield* response.json);
  return { response, body };
}, Effect.timeout("60 seconds"));

const runFixture = Effect.fn("AgentSmoke.runFixture")(
  function* (root: string, args: readonly string[]) {
    const child = yield* ChildProcess.make(
      "swift",
      ["Scripts/macos_agent_fixture.swift", ...args],
      {
        cwd: root,
        stdin: "ignore",
        stderr: "inherit",
      },
    );
    const stdout = yield* child.stdout.pipe(
      Stream.decodeText(),
      Stream.runFold(
        () => "",
        (text, part) => text + part,
      ),
    );
    if ((yield* child.exitCode) !== 0) {
      return yield* new AgentSmokeError({
        message: "Unable to create or inspect Agent media fixture.",
      });
    }
    return stdout;
  },
  Effect.timeout("60 seconds"),
  Effect.scoped,
);

const expectStatus = Effect.fn("AgentSmoke.expectStatus")(function* (
  actual: number,
  expected: number,
  body: unknown,
) {
  if (actual !== expected) {
    return yield* new AgentSmokeError({
      message: `Expected HTTP ${expected}, received ${actual}: ${JSON.stringify(body)}`,
    });
  }
});

const main = Effect.fn("AgentSmoke.main")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(import.meta.dir, "..");
  const join = path.join;
  const enginePath = join(root, ".build", "debug", "guerillaglass-engine");
  if (process.platform !== "darwin") {
    return yield* new AgentSmokeError({
      message: "Agent Mode smoke requires the production macOS engine.",
    });
  }
  if (!(yield* fs.exists(enginePath))) {
    return yield* new AgentSmokeError({
      message: `Missing ${enginePath}; run bun run swift:build first.`,
    });
  }
  const temporaryDirectory = yield* fs.makeTempDirectory({ prefix: "guerillaglass-agent-smoke-" });
  const temporaryRoot = yield* fs.realPath(temporaryDirectory);
  yield* Effect.addFinalizer(() =>
    process.argv.includes("--keep")
      ? Effect.void
      : fs.remove(temporaryRoot, { recursive: true }).pipe(Effect.orDie),
  );
  const projectPath = join(temporaryRoot, "AgentSmoke.gglassproj");
  const transcriptPath = join(temporaryRoot, "transcript.json");
  const outputPath = join(temporaryRoot, "agent-output.mp4");
  yield* fs.makeDirectory(projectPath, { recursive: true });
  yield* fs.writeFileString(
    transcriptPath,
    JSON.stringify({
      segments: [
        { text: "Opening hook", startSeconds: 0.25, endSeconds: 1 },
        { text: "Action steps", startSeconds: 2, endSeconds: 3 },
        { text: "Result payoff", startSeconds: 4, endSeconds: 5 },
        { text: "Conclusion takeaway", startSeconds: 6, endSeconds: 7.25 },
      ],
    }),
  );
  let engineScope = yield* Scope.make();
  yield* Effect.addFinalizer((exit) => Scope.close(engineScope, exit));
  let engine = yield* makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 15_000 }).pipe(
    Scope.provide(engineScope),
  );
  const capabilities = yield* request(engine, "/v1/engine/capabilities");
  yield* expectStatus(capabilities.response.status, 200, capabilities.body);
  const agentCapabilities = yield* Schema.decodeUnknownEffect(WireObject)(capabilities.body.agent);
  if (
    agentCapabilities.apply !== true ||
    agentCapabilities.preflightTokenTtlSeconds !== 60 ||
    !Array.isArray(agentCapabilities.supportedTranscriptionProviders) ||
    !agentCapabilities.supportedTranscriptionProviders.includes("imported_transcript")
  ) {
    return yield* new AgentSmokeError({
      message: `Agent capabilities are not truthful: ${JSON.stringify(agentCapabilities)}`,
    });
  }

  let opened = yield* request(engine, "/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  yield* expectStatus(opened.response.status, 200, opened.body);

  yield* runFixture(root, [join(projectPath, "recording.mov")]);

  opened = yield* request(engine, "/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  yield* expectStatus(opened.response.status, 200, opened.body);

  const runParameters = {
    runtimeBudgetMinutes: 10,
    transcriptionProvider: "imported_transcript",
    importedTranscriptPath: transcriptPath,
  };
  const preflight = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(runParameters),
  });
  yield* expectStatus(preflight.response.status, 200, preflight.body);
  if (
    preflight.body.ready !== true ||
    typeof preflight.body.preflightToken !== "string" ||
    typeof preflight.body.preflightTokenExpiresAt !== "string"
  ) {
    return yield* new AgentSmokeError({
      message: `Agent preflight was not ready: ${JSON.stringify(preflight.body)}`,
    });
  }
  const tokenLifetimeSeconds =
    (Date.parse(preflight.body.preflightTokenExpiresAt) - Date.now()) / 1000;
  if (tokenLifetimeSeconds < 50 || tokenLifetimeSeconds > 61) {
    return yield* new AgentSmokeError({
      message: `Unexpected preflight token lifetime: ${tokenLifetimeSeconds}`,
    });
  }

  const pendingTokens: string[] = [];
  for (let index = 0; index < 3; index++) {
    const pending = yield* request(engine, "/v1/agent/preflight", {
      method: "POST",
      body: JSON.stringify(runParameters),
    });
    yield* expectStatus(pending.response.status, 200, pending.body);
    pendingTokens.push(
      yield* Schema.decodeUnknownEffect(Schema.String)(pending.body.preflightToken),
    );
  }
  const capacity = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(runParameters),
  });
  yield* expectStatus(capacity.response.status, 200, capacity.body);
  const capacityReasons = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.String))(
    capacity.body.blockingReasons,
  );
  if (
    capacity.body.ready !== false ||
    !capacityReasons.includes("preflight_capacity") ||
    "preflightToken" in capacity.body
  ) {
    return yield* new AgentSmokeError({
      message: "Excess preflights must be blocked without revoking live tokens.",
    });
  }
  for (const token of pendingTokens) {
    const consumed = yield* request(engine, "/v1/agent/runs", {
      method: "POST",
      body: JSON.stringify({ ...runParameters, preflightToken: token }),
    });
    yield* expectStatus(consumed.response.status, 200, consumed.body);
  }

  const run = yield* request(engine, "/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({ ...runParameters, preflightToken: preflight.body.preflightToken }),
  });
  yield* expectStatus(run.response.status, 200, run.body);
  let jobId = yield* Schema.decodeUnknownEffect(Schema.String)(run.body.jobId);
  if (run.body.status !== "completed" || typeof jobId !== "string") {
    return yield* new AgentSmokeError({
      message: `Agent run did not complete: ${JSON.stringify(run.body)}`,
    });
  }
  const reusedToken = yield* request(engine, "/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({ ...runParameters, preflightToken: preflight.body.preflightToken }),
  });
  yield* expectStatus(reusedToken.response.status, 400, reusedToken.body);
  if (reusedToken.body.code !== "preflight_expired") {
    return yield* new AgentSmokeError({
      message: `Reused preflight token was not rejected predictably: ${JSON.stringify(reusedToken.body)}`,
    });
  }

  const status = yield* request(engine, `/v1/agent/runs/${encodeURIComponent(jobId)}`);
  yield* expectStatus(status.response.status, 200, status.body);
  const cutPlan = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ segments: Schema.Array(Schema.Unknown) }),
  )(status.body.cutPlan);
  const artifacts = yield* Schema.decodeUnknownEffect(
    Schema.Array(Schema.Struct({ path: Schema.String })),
  )(status.body.artifacts);
  if (
    status.body.status !== "completed" ||
    cutPlan.segments?.length !== 4 ||
    artifacts.length !== 6
  ) {
    return yield* new AgentSmokeError({
      message: `Agent status is not reviewable: ${JSON.stringify(status.body)}`,
    });
  }
  for (const artifact of artifacts) {
    if (artifact.path.startsWith("/") || !(yield* fs.exists(join(projectPath, artifact.path)))) {
      return yield* new AgentSmokeError({
        message: `Invalid or missing project-relative artifact: ${artifact.path}`,
      });
    }
    yield* readObject(join(projectPath, artifact.path));
  }

  const info = yield* request(engine, "/v1/export/info");
  yield* expectStatus(info.response.status, 200, info.body);
  const presets = yield* Schema.decodeUnknownEffect(
    Schema.Array(Schema.Struct({ id: Schema.String })),
  )(info.body.presets);
  const presetId = presets.find((preset) => preset.id.includes("1080p-30"))?.id ?? presets[0]?.id;
  if (!presetId) {
    return yield* new AgentSmokeError({ message: "Engine did not advertise an export preset." });
  }
  const independentOutputPath = join(temporaryRoot, "agent-output-before-apply.mp4");
  const independentExport = yield* request(engine, "/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: independentOutputPath }),
  });
  yield* expectStatus(independentExport.response.status, 200, independentExport.body);
  if (independentExport.body.appliedSegments !== 4 || !(yield* fs.exists(independentOutputPath))) {
    return yield* new AgentSmokeError({
      message: `Cut-plan export incorrectly depended on prior apply: ${JSON.stringify(independentExport.body)}`,
    });
  }

  const changedTimeline = {
    version: 2,
    updatedAt: new Date().toISOString(),
    items: [
      {
        kind: "clip",
        id: "manual-edit",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 1,
      },
    ],
  };
  const saved = yield* request(engine, "/v1/project/save", {
    method: "POST",
    body: JSON.stringify({ timeline: changedTimeline }),
  });
  yield* expectStatus(saved.response.status, 200, saved.body);

  const confirmation = yield* request(engine, `/v1/agent/runs/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: "{}",
  });
  yield* expectStatus(confirmation.response.status, 409, confirmation.body);
  if (confirmation.body.code !== "needs_confirmation") {
    return yield* new AgentSmokeError({
      message: `Apply confirmation was not typed: ${JSON.stringify(confirmation.body)}`,
    });
  }

  const applied = yield* request(engine, `/v1/agent/runs/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: JSON.stringify({ destructiveIntent: true }),
  });
  yield* expectStatus(applied.response.status, 200, applied.body);
  if (applied.body.status !== "applied" || applied.body.appliedSegments !== 4) {
    return yield* new AgentSmokeError({
      message: `Apply result was not verifiable: ${JSON.stringify(applied.body)}`,
    });
  }
  const currentAfterApply = yield* request(engine, "/v1/project/current");
  yield* expectStatus(currentAfterApply.response.status, 200, currentAfterApply.body);
  const currentTimeline = yield* Schema.decodeUnknownEffect(
    Schema.Struct({
      items: Schema.Array(
        Schema.Struct({
          kind: Schema.String,
          sourceStartSeconds: Schema.Finite,
          sourceEndSeconds: Schema.Finite,
        }),
      ),
    }),
  )(currentAfterApply.body.timeline);
  const appliedItems = currentTimeline?.items;
  const reviewPlan = yield* Schema.decodeUnknownEffect(
    Schema.Struct({
      sourceFps: Schema.Struct({ numerator: Schema.Finite, denominator: Schema.Finite }),
      segments: Schema.Array(Schema.Struct({ startFrame: Schema.Finite, endFrame: Schema.Finite })),
    }),
  )(status.body.cutPlan);
  if (
    appliedItems?.length !== reviewPlan.segments.length ||
    appliedItems.some((item, index) => {
      const segment = reviewPlan.segments[index];
      if (segment === undefined) {
        return true;
      }
      const secondsPerFrame = reviewPlan.sourceFps.denominator / reviewPlan.sourceFps.numerator;
      return (
        item.kind !== "clip" ||
        Math.abs(item.sourceStartSeconds - segment.startFrame * secondsPerFrame) > 1e-6 ||
        Math.abs(item.sourceEndSeconds - segment.endFrame * secondsPerFrame) > 1e-6
      );
    })
  ) {
    return yield* new AgentSmokeError({
      message: `Applied working timeline differs from the reviewed frame plan: ${JSON.stringify(currentAfterApply.body.timeline)}`,
    });
  }

  const persistedBeforeAnalysis = yield* readObject(join(projectPath, "project.json"));
  const nextPreflight = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(runParameters),
  });
  yield* expectStatus(nextPreflight.response.status, 200, nextPreflight.body);
  const nextRun = yield* request(engine, "/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({ ...runParameters, preflightToken: nextPreflight.body.preflightToken }),
  });
  yield* expectStatus(nextRun.response.status, 200, nextRun.body);
  if (typeof nextRun.body.jobId !== "string") {
    return yield* new AgentSmokeError({ message: "Second analysis returned no job identity." });
  }
  jobId = nextRun.body.jobId;
  const persistedAfterAnalysis = yield* readObject(join(projectPath, "project.json"));
  if (JSON.stringify(persistedAfterAnalysis) !== JSON.stringify(persistedBeforeAnalysis)) {
    return yield* new AgentSmokeError({
      message: "Analysis persisted the unsaved working timeline before explicit save.",
    });
  }

  for (let index = 0; index < 5; index++) {
    const replacementPreflight = yield* request(engine, "/v1/agent/preflight", {
      method: "POST",
      body: JSON.stringify(runParameters),
    });
    yield* expectStatus(replacementPreflight.response.status, 200, replacementPreflight.body);
    const [previousStatus, replacement] = yield* Effect.all(
      [
        request(engine, `/v1/agent/runs/${encodeURIComponent(jobId)}`),
        request(engine, "/v1/agent/runs", {
          method: "POST",
          body: JSON.stringify({
            ...runParameters,
            preflightToken: replacementPreflight.body.preflightToken,
          }),
        }),
      ],
      { concurrency: 2 },
    );
    if (![200, 404].includes(previousStatus.response.status)) {
      return yield* new AgentSmokeError({
        message: "Concurrent status must resolve the still-current run or reject its replacement.",
      });
    }
    yield* expectStatus(replacement.response.status, 200, replacement.body);
    jobId = yield* Schema.decodeUnknownEffect(Schema.String)(replacement.body.jobId);
    const current = yield* request(engine, "/v1/project/current");
    yield* expectStatus(current.response.status, 200, current.body);
    const summaryState = yield* Schema.decodeUnknownEffect(WireObject)(current.body.agentAnalysis);
    if (summaryState.latestJobId !== jobId) {
      return yield* new AgentSmokeError({
        message: "An obsolete status lookup replaced the latest committed run.",
      });
    }
  }

  const exported = yield* request(engine, "/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: outputPath }),
  });
  yield* expectStatus(exported.response.status, 200, exported.body);
  if (exported.body.appliedSegments !== 4 || !(yield* fs.exists(outputPath))) {
    return yield* new AgentSmokeError({
      message: `Cut-plan export failed verification: ${JSON.stringify(exported.body)}`,
    });
  }
  const statusCutPlan = reviewPlan;
  const secondsPerFrame = statusCutPlan.sourceFps.denominator / statusCutPlan.sourceFps.numerator;
  let outputCursor = 0;
  const outputSampleTimes = statusCutPlan.segments.map((segment) => {
    const duration = (segment.endFrame - segment.startFrame) * secondsPerFrame;
    const sampleTime = outputCursor + duration / 2;
    outputCursor += duration;
    return sampleTime;
  });
  const media = yield* Schema.decodeEffect(
    Schema.fromJsonString(
      Schema.Struct({
        durationSeconds: Schema.Finite,
        hasVideo: Schema.Boolean,
        sampleColors: Schema.Array(Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])),
      }),
    ),
  )(yield* runFixture(root, ["--probe", outputPath, outputSampleTimes.join(",")]));
  const expectedDuration =
    statusCutPlan.segments.reduce(
      (duration, segment) => duration + segment.endFrame - segment.startFrame,
      0,
    ) *
    (statusCutPlan.sourceFps.denominator / statusCutPlan.sourceFps.numerator);
  const dominantChannels = media.sampleColors.map((color) => color.indexOf(Math.max(...color)));
  if (
    !media.hasVideo ||
    Math.abs(media.durationSeconds - expectedDuration) > 0.1 ||
    dominantChannels.join(",") !== "2,0,2,0"
  ) {
    return yield* new AgentSmokeError({
      message: `Decoded Agent export content does not match its ordered frame plan: ${JSON.stringify({ media, expectedDuration, dominantChannels })}`,
    });
  }

  const summary = yield* readObject(join(projectPath, "analysis", "run-summary.v1.json"));
  if (summary.jobId !== jobId) {
    return yield* new AgentSmokeError({ message: "Run summary did not persist run identity." });
  }
  yield* Scope.close(engineScope, Exit.void);
  engineScope = yield* Scope.make();
  engine = yield* makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 15_000 }).pipe(
    Scope.provide(engineScope),
  );

  const reopened = yield* request(engine, "/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  yield* expectStatus(reopened.response.status, 200, reopened.body);
  const recovered = yield* request(engine, `/v1/agent/runs/${encodeURIComponent(jobId)}`);
  yield* expectStatus(recovered.response.status, 200, recovered.body);
  if (recovered.body.status !== "completed" || recovered.body.cutPlan == null) {
    return yield* new AgentSmokeError({
      message: `Agent run did not recover after restart: ${JSON.stringify(recovered.body)}`,
    });
  }
  const recoveredOutputPath = join(temporaryRoot, "agent-output-after-restart.mp4");
  const recoveredExport = yield* request(engine, "/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: recoveredOutputPath }),
  });
  yield* expectStatus(recoveredExport.response.status, 200, recoveredExport.body);
  if (recoveredExport.body.appliedSegments !== 4 || !(yield* fs.exists(recoveredOutputPath))) {
    return yield* new AgentSmokeError({
      message: `Recovered run was not exportable after restart: ${JSON.stringify(recoveredExport.body)}`,
    });
  }

  const recordingPath = join(projectPath, "recording.mov");
  const originalRecordingSize = Number((yield* fs.stat(recordingPath)).size);
  yield* fs.writeFile(recordingPath, new Uint8Array([0]), { flag: "a" });
  const staleRecordingExport = yield* request(engine, "/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: join(temporaryRoot, "stale.mp4") }),
  });
  yield* expectStatus(staleRecordingExport.response.status, 409, staleRecordingExport.body);
  if (staleRecordingExport.body.code !== "project_mismatch") {
    return yield* new AgentSmokeError({
      message: `Changed recording was not rejected predictably: ${JSON.stringify(staleRecordingExport.body)}`,
    });
  }
  yield* fs.truncate(recordingPath, originalRecordingSize);

  const transcriptAliasDirectory = join(temporaryRoot, "transcript-alias");
  yield* fs.symlink(temporaryRoot, transcriptAliasDirectory);
  const symlinkedTranscriptPreflight = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
      importedTranscriptPath: join(transcriptAliasDirectory, "transcript.json"),
    }),
  });
  yield* expectStatus(
    symlinkedTranscriptPreflight.response.status,
    200,
    symlinkedTranscriptPreflight.body,
  );
  const symlinkedTranscriptBlockers = yield* Schema.decodeUnknownEffect(
    Schema.Array(Schema.String),
  )(symlinkedTranscriptPreflight.body.blockingReasons);
  if (
    symlinkedTranscriptPreflight.body.ready !== false ||
    !symlinkedTranscriptBlockers?.includes("invalid_imported_transcript")
  ) {
    return yield* new AgentSmokeError({
      message: `A transcript below a symlinked ancestor was not rejected: ${JSON.stringify(symlinkedTranscriptPreflight.body)}`,
    });
  }

  const malformedTranscriptPath = join(temporaryRoot, "malformed-transcript.json");
  yield* fs.writeFileString(malformedTranscriptPath, "not-json");
  const malformedPreflight = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
      importedTranscriptPath: malformedTranscriptPath,
    }),
  });
  yield* expectStatus(malformedPreflight.response.status, 200, malformedPreflight.body);
  const malformedTranscriptBlockers = yield* Schema.decodeUnknownEffect(
    Schema.Array(Schema.String),
  )(malformedPreflight.body.blockingReasons);
  if (
    malformedPreflight.body.ready !== false ||
    !malformedTranscriptBlockers?.includes("invalid_imported_transcript")
  ) {
    return yield* new AgentSmokeError({
      message: `Malformed transcript did not produce a typed blocker: ${JSON.stringify(malformedPreflight.body)}`,
    });
  }

  const blockedTranscriptPath = join(temporaryRoot, "blocked-transcript.json");
  yield* fs.writeFileString(
    blockedTranscriptPath,
    JSON.stringify({
      segments: [{ text: "Opening hook only", startSeconds: 0.25, endSeconds: 1 }],
    }),
  );
  const blockedParameters = {
    runtimeBudgetMinutes: 10,
    transcriptionProvider: "imported_transcript",
    importedTranscriptPath: blockedTranscriptPath,
  };
  const blockedPreflight = yield* request(engine, "/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(blockedParameters),
  });
  yield* expectStatus(blockedPreflight.response.status, 200, blockedPreflight.body);
  const blockedRun = yield* request(engine, "/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({
      ...blockedParameters,
      preflightToken: blockedPreflight.body.preflightToken,
    }),
  });
  yield* expectStatus(blockedRun.response.status, 200, blockedRun.body);
  if (blockedRun.body.status !== "blocked" || typeof blockedRun.body.jobId !== "string") {
    return yield* new AgentSmokeError({
      message: `Weak narrative was not blocked: ${JSON.stringify(blockedRun.body)}`,
    });
  }
  const blockedApply = yield* request(
    engine,
    `/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}/apply`,
    { method: "POST", body: JSON.stringify({ destructiveIntent: true }) },
  );
  yield* expectStatus(blockedApply.response.status, 422, blockedApply.body);
  if (blockedApply.body.code !== "qa_failed") {
    return yield* new AgentSmokeError({
      message: `QA failure was not typed: ${JSON.stringify(blockedApply.body)}`,
    });
  }

  const otherProjectPath = join(temporaryRoot, "Other.gglassproj");
  yield* fs.makeDirectory(otherProjectPath, { recursive: true });
  yield* fs.copyFile(recordingPath, join(otherProjectPath, "recording.mov"));
  const switched = yield* request(engine, "/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath: otherProjectPath }),
  });
  yield* expectStatus(switched.response.status, 200, switched.body);
  const crossProject = yield* request(
    engine,
    `/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}`,
  );
  yield* expectStatus(crossProject.response.status, 404, crossProject.body);
  const crossProjectApply = yield* request(
    engine,
    `/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}/apply`,
    { method: "POST", body: JSON.stringify({ destructiveIntent: true }) },
  );
  yield* expectStatus(crossProjectApply.response.status, 404, crossProjectApply.body);
  const crossProjectExport = yield* request(engine, "/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({
      jobId: blockedRun.body.jobId,
      presetId,
      outputURL: join(temporaryRoot, "cross-project.mp4"),
    }),
  });
  yield* expectStatus(crossProjectExport.response.status, 404, crossProjectExport.body);

  for (let index = 0; index < 5; index++) {
    yield* Effect.all(
      [projectPath, otherProjectPath].map((path) =>
        request(engine, "/v1/project/open", {
          method: "POST",
          body: JSON.stringify({ projectPath: path }),
        }),
      ),
      { concurrency: 2 },
    );
    const active = yield* request(engine, "/v1/project/current");
    yield* expectStatus(active.response.status, 200, active.body);
    const analysis = yield* Schema.decodeUnknownEffect(
      Schema.UndefinedOr(Schema.NullOr(WireObject)),
    )(active.body.agentAnalysis);
    if (
      active.body.projectPath === otherProjectPath &&
      analysis?.latestJobId !== undefined &&
      analysis?.latestJobId !== null
    ) {
      return yield* new AgentSmokeError({
        message: "Delayed recovery attached a previous project's run to the active project.",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        jobId,
        appliedSegments: 4,
        artifactCount: artifacts.length,
        outputPath,
      },
      null,
      2,
    ),
  );
}, Effect.scoped);

NodeRuntime.runMain(
  main().pipe(Effect.provide(NodeHttpClient.layerNodeHttp), Effect.provide(NodeServices.layer)),
);
