#!/usr/bin/env bun

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const enginePath = join(root, ".build", "debug", "guerillaglass-engine");
if (process.platform !== "darwin") {
  throw new Error("Agent Mode smoke requires the production macOS engine.");
}
if (!existsSync(enginePath)) {
  throw new Error(`Missing ${enginePath}; run bun run swift:build first.`);
}

const resolvedTemporaryDirectory = tmpdir().startsWith("/var/") ? `/private${tmpdir()}` : tmpdir();
const temporaryRoot = mkdtempSync(join(resolvedTemporaryDirectory, "guerillaglass-agent-smoke-"));
const projectPath = join(temporaryRoot, "AgentSmoke.gglassproj");
const transcriptPath = join(temporaryRoot, "transcript.json");
const outputPath = join(temporaryRoot, "agent-output.mp4");
const bearerToken = crypto.randomUUID().replaceAll("-", "");
mkdirSync(projectPath, { recursive: true });
await Bun.write(
  transcriptPath,
  JSON.stringify(
    {
      segments: [
        { text: "Opening hook", startSeconds: 0.25, endSeconds: 1 },
        { text: "Action steps", startSeconds: 2, endSeconds: 3 },
        { text: "Result payoff", startSeconds: 4, endSeconds: 5 },
        { text: "Conclusion takeaway", startSeconds: 6, endSeconds: 7.25 },
      ],
    },
    null,
    2,
  ),
);

const launchEngine = () =>
  Bun.spawn([enginePath], {
    cwd: root,
    env: {
      ...process.env,
      GG_ENGINE_TRANSPORT: "http",
      GG_ENGINE_HTTP_AUTH_TOKEN: bearerToken,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
let engine = launchEngine();

async function readinessBaseUrl(process: typeof engine): Promise<string> {
  const reader = process.stdout.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    buffered += decoder.decode(next.value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      const value = JSON.parse(line) as { type?: string; host?: string; port?: number };
      if (value.type === "guerillaglass.engine.http.ready" && value.host && value.port) {
        return `http://${value.host}:${value.port}`;
      }
    }
  }
  throw new Error("Engine did not emit its HTTP readiness envelope.");
}

let baseUrl = await readinessBaseUrl(engine);
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

function expectStatus(actual: number, expected: number, body: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected HTTP ${expected}, received ${actual}: ${JSON.stringify(body)}`);
  }
}

try {
  const capabilities = await request("/v1/engine/capabilities");
  expectStatus(capabilities.response.status, 200, capabilities.body);
  const agentCapabilities = capabilities.body.agent as Record<string, unknown>;
  if (
    agentCapabilities.apply !== true ||
    agentCapabilities.preflightTokenTtlSeconds !== 60 ||
    !Array.isArray(agentCapabilities.supportedTranscriptionProviders) ||
    !agentCapabilities.supportedTranscriptionProviders.includes("imported_transcript")
  ) {
    throw new Error(`Agent capabilities are not truthful: ${JSON.stringify(agentCapabilities)}`);
  }

  let opened = await request("/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  expectStatus(opened.response.status, 200, opened.body);

  const fixture = Bun.spawnSync(
    ["swift", "Scripts/macos_agent_fixture.swift", join(projectPath, "recording.mov")],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (fixture.exitCode !== 0) {
    throw new Error(`Unable to create Agent fixture: ${fixture.stderr.toString()}`);
  }

  opened = await request("/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  expectStatus(opened.response.status, 200, opened.body);

  const runParameters = {
    runtimeBudgetMinutes: 10,
    transcriptionProvider: "imported_transcript",
    importedTranscriptPath: transcriptPath,
  };
  const preflight = await request("/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(runParameters),
  });
  expectStatus(preflight.response.status, 200, preflight.body);
  if (
    preflight.body.ready !== true ||
    typeof preflight.body.preflightToken !== "string" ||
    typeof preflight.body.preflightTokenExpiresAt !== "string"
  ) {
    throw new Error(`Agent preflight was not ready: ${JSON.stringify(preflight.body)}`);
  }
  const tokenLifetimeSeconds =
    (Date.parse(preflight.body.preflightTokenExpiresAt) - Date.now()) / 1000;
  if (tokenLifetimeSeconds < 50 || tokenLifetimeSeconds > 61) {
    throw new Error(`Unexpected preflight token lifetime: ${tokenLifetimeSeconds}`);
  }

  const run = await request("/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({ ...runParameters, preflightToken: preflight.body.preflightToken }),
  });
  expectStatus(run.response.status, 200, run.body);
  const jobId = run.body.jobId;
  if (run.body.status !== "completed" || typeof jobId !== "string") {
    throw new Error(`Agent run did not complete: ${JSON.stringify(run.body)}`);
  }
  const reusedToken = await request("/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({ ...runParameters, preflightToken: preflight.body.preflightToken }),
  });
  expectStatus(reusedToken.response.status, 400, reusedToken.body);
  if (reusedToken.body.code !== "preflight_expired") {
    throw new Error(
      `Reused preflight token was not rejected predictably: ${JSON.stringify(reusedToken.body)}`,
    );
  }

  const status = await request(`/v1/agent/runs/${encodeURIComponent(jobId)}`);
  expectStatus(status.response.status, 200, status.body);
  const cutPlan = status.body.cutPlan as { segments?: unknown[] };
  const artifacts = status.body.artifacts as Array<{ path: string }>;
  if (
    status.body.status !== "completed" ||
    cutPlan.segments?.length !== 4 ||
    artifacts.length !== 6
  ) {
    throw new Error(`Agent status is not reviewable: ${JSON.stringify(status.body)}`);
  }
  for (const artifact of artifacts) {
    if (artifact.path.startsWith("/") || !existsSync(join(projectPath, artifact.path))) {
      throw new Error(`Invalid or missing project-relative artifact: ${artifact.path}`);
    }
    JSON.parse(readFileSync(join(projectPath, artifact.path), "utf8"));
  }

  const info = await request("/v1/export/info");
  expectStatus(info.response.status, 200, info.body);
  const presets = info.body.presets as Array<{ id: string }>;
  const presetId = presets.find((preset) => preset.id.includes("1080p-30"))?.id ?? presets[0]?.id;
  if (!presetId) {
    throw new Error("Engine did not advertise an export preset.");
  }
  const independentOutputPath = join(temporaryRoot, "agent-output-before-apply.mp4");
  const independentExport = await request("/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: independentOutputPath }),
  });
  expectStatus(independentExport.response.status, 200, independentExport.body);
  if (independentExport.body.appliedSegments !== 4 || !existsSync(independentOutputPath)) {
    throw new Error(
      `Cut-plan export incorrectly depended on prior apply: ${JSON.stringify(independentExport.body)}`,
    );
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
  const saved = await request("/v1/project/save", {
    method: "POST",
    body: JSON.stringify({ timeline: changedTimeline }),
  });
  expectStatus(saved.response.status, 200, saved.body);

  const confirmation = await request(`/v1/agent/runs/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: "{}",
  });
  expectStatus(confirmation.response.status, 409, confirmation.body);
  if (confirmation.body.code !== "needs_confirmation") {
    throw new Error(`Apply confirmation was not typed: ${JSON.stringify(confirmation.body)}`);
  }

  const applied = await request(`/v1/agent/runs/${encodeURIComponent(jobId)}/apply`, {
    method: "POST",
    body: JSON.stringify({ destructiveIntent: true }),
  });
  expectStatus(applied.response.status, 200, applied.body);
  if (applied.body.status !== "applied" || applied.body.appliedSegments !== 4) {
    throw new Error(`Apply result was not verifiable: ${JSON.stringify(applied.body)}`);
  }
  const currentAfterApply = await request("/v1/project/current");
  expectStatus(currentAfterApply.response.status, 200, currentAfterApply.body);
  const currentTimeline = currentAfterApply.body.timeline as
    | { items?: Array<{ kind: string; sourceStartSeconds: number; sourceEndSeconds: number }> }
    | undefined;
  const appliedItems = currentTimeline?.items;
  const reviewPlan = status.body.cutPlan as {
    sourceFps: { numerator: number; denominator: number };
    segments: Array<{ startFrame: number; endFrame: number }>;
  };
  if (
    appliedItems?.length !== reviewPlan.segments.length ||
    appliedItems.some((item, index) => {
      const segment = reviewPlan.segments[index]!;
      const secondsPerFrame = reviewPlan.sourceFps.denominator / reviewPlan.sourceFps.numerator;
      return (
        item.kind !== "clip" ||
        Math.abs(item.sourceStartSeconds - segment.startFrame * secondsPerFrame) > 1e-6 ||
        Math.abs(item.sourceEndSeconds - segment.endFrame * secondsPerFrame) > 1e-6
      );
    })
  ) {
    throw new Error(
      `Applied working timeline differs from the reviewed frame plan: ${JSON.stringify(currentAfterApply.body.timeline)}`,
    );
  }

  const exported = await request("/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: outputPath }),
  });
  expectStatus(exported.response.status, 200, exported.body);
  if (exported.body.appliedSegments !== 4 || !existsSync(outputPath)) {
    throw new Error(`Cut-plan export failed verification: ${JSON.stringify(exported.body)}`);
  }
  const statusCutPlan = status.body.cutPlan as {
    sourceFps: { numerator: number; denominator: number };
    segments: Array<{ startFrame: number; endFrame: number }>;
  };
  const secondsPerFrame = statusCutPlan.sourceFps.denominator / statusCutPlan.sourceFps.numerator;
  let outputCursor = 0;
  const outputSampleTimes = statusCutPlan.segments.map((segment) => {
    const duration = (segment.endFrame - segment.startFrame) * secondsPerFrame;
    const sampleTime = outputCursor + duration / 2;
    outputCursor += duration;
    return sampleTime;
  });
  const mediaProbe = Bun.spawnSync(
    [
      "swift",
      "Scripts/macos_agent_fixture.swift",
      "--probe",
      outputPath,
      outputSampleTimes.join(","),
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (mediaProbe.exitCode !== 0) {
    throw new Error(`Unable to inspect Agent export: ${mediaProbe.stderr.toString()}`);
  }
  const media = JSON.parse(mediaProbe.stdout.toString()) as {
    durationSeconds: number;
    hasVideo: boolean;
    sampleColors: Array<[number, number, number]>;
  };
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
    throw new Error(
      `Decoded Agent export content does not match its ordered frame plan: ${JSON.stringify({ media, expectedDuration, dominantChannels })}`,
    );
  }

  const summary = JSON.parse(
    readFileSync(join(projectPath, "analysis", "run-summary.v1.json"), "utf8"),
  ) as { jobId?: string };
  if (summary.jobId !== jobId) {
    throw new Error(`Run summary did not persist run identity: ${JSON.stringify(summary)}`);
  }

  engine.kill("SIGTERM");
  await engine.exited;
  engine = launchEngine();
  baseUrl = await readinessBaseUrl(engine);
  const reopened = await request("/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath }),
  });
  expectStatus(reopened.response.status, 200, reopened.body);
  const recovered = await request(`/v1/agent/runs/${encodeURIComponent(jobId)}`);
  expectStatus(recovered.response.status, 200, recovered.body);
  if (recovered.body.status !== "completed" || recovered.body.cutPlan == null) {
    throw new Error(`Agent run did not recover after restart: ${JSON.stringify(recovered.body)}`);
  }
  const recoveredOutputPath = join(temporaryRoot, "agent-output-after-restart.mp4");
  const recoveredExport = await request("/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: recoveredOutputPath }),
  });
  expectStatus(recoveredExport.response.status, 200, recoveredExport.body);
  if (recoveredExport.body.appliedSegments !== 4 || !existsSync(recoveredOutputPath)) {
    throw new Error(
      `Recovered run was not exportable after restart: ${JSON.stringify(recoveredExport.body)}`,
    );
  }

  const recordingPath = join(projectPath, "recording.mov");
  const originalRecordingSize = statSync(recordingPath).size;
  appendFileSync(recordingPath, new Uint8Array([0]));
  const staleRecordingExport = await request("/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({ jobId, presetId, outputURL: join(temporaryRoot, "stale.mp4") }),
  });
  expectStatus(staleRecordingExport.response.status, 409, staleRecordingExport.body);
  if (staleRecordingExport.body.code !== "project_mismatch") {
    throw new Error(
      `Changed recording was not rejected predictably: ${JSON.stringify(staleRecordingExport.body)}`,
    );
  }
  truncateSync(recordingPath, originalRecordingSize);

  const transcriptAliasDirectory = join(temporaryRoot, "transcript-alias");
  symlinkSync(temporaryRoot, transcriptAliasDirectory, "dir");
  const symlinkedTranscriptPreflight = await request("/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
      importedTranscriptPath: join(transcriptAliasDirectory, "transcript.json"),
    }),
  });
  expectStatus(
    symlinkedTranscriptPreflight.response.status,
    200,
    symlinkedTranscriptPreflight.body,
  );
  const symlinkedTranscriptBlockers = symlinkedTranscriptPreflight.body.blockingReasons as
    | unknown[]
    | undefined;
  if (
    symlinkedTranscriptPreflight.body.ready !== false ||
    !symlinkedTranscriptBlockers?.includes("invalid_imported_transcript")
  ) {
    throw new Error(
      `A transcript below a symlinked ancestor was not rejected: ${JSON.stringify(symlinkedTranscriptPreflight.body)}`,
    );
  }

  const malformedTranscriptPath = join(temporaryRoot, "malformed-transcript.json");
  await Bun.write(malformedTranscriptPath, "not-json");
  const malformedPreflight = await request("/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
      importedTranscriptPath: malformedTranscriptPath,
    }),
  });
  expectStatus(malformedPreflight.response.status, 200, malformedPreflight.body);
  const malformedTranscriptBlockers = malformedPreflight.body.blockingReasons as
    | unknown[]
    | undefined;
  if (
    malformedPreflight.body.ready !== false ||
    !malformedTranscriptBlockers?.includes("invalid_imported_transcript")
  ) {
    throw new Error(
      `Malformed transcript did not produce a typed blocker: ${JSON.stringify(malformedPreflight.body)}`,
    );
  }

  const blockedTranscriptPath = join(temporaryRoot, "blocked-transcript.json");
  await Bun.write(
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
  const blockedPreflight = await request("/v1/agent/preflight", {
    method: "POST",
    body: JSON.stringify(blockedParameters),
  });
  expectStatus(blockedPreflight.response.status, 200, blockedPreflight.body);
  const blockedRun = await request("/v1/agent/runs", {
    method: "POST",
    body: JSON.stringify({
      ...blockedParameters,
      preflightToken: blockedPreflight.body.preflightToken,
    }),
  });
  expectStatus(blockedRun.response.status, 200, blockedRun.body);
  if (blockedRun.body.status !== "blocked" || typeof blockedRun.body.jobId !== "string") {
    throw new Error(`Weak narrative was not blocked: ${JSON.stringify(blockedRun.body)}`);
  }
  const blockedApply = await request(
    `/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}/apply`,
    { method: "POST", body: JSON.stringify({ destructiveIntent: true }) },
  );
  expectStatus(blockedApply.response.status, 422, blockedApply.body);
  if (blockedApply.body.code !== "qa_failed") {
    throw new Error(`QA failure was not typed: ${JSON.stringify(blockedApply.body)}`);
  }

  const otherProjectPath = join(temporaryRoot, "Other.gglassproj");
  mkdirSync(otherProjectPath, { recursive: true });
  await Bun.write(join(otherProjectPath, "recording.mov"), readFileSync(recordingPath));
  const switched = await request("/v1/project/open", {
    method: "POST",
    body: JSON.stringify({ projectPath: otherProjectPath }),
  });
  expectStatus(switched.response.status, 200, switched.body);
  const crossProject = await request(`/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}`);
  expectStatus(crossProject.response.status, 404, crossProject.body);
  const crossProjectApply = await request(
    `/v1/agent/runs/${encodeURIComponent(blockedRun.body.jobId)}/apply`,
    { method: "POST", body: JSON.stringify({ destructiveIntent: true }) },
  );
  expectStatus(crossProjectApply.response.status, 404, crossProjectApply.body);
  const crossProjectExport = await request("/v1/exports/from-cut-plan", {
    method: "POST",
    body: JSON.stringify({
      jobId: blockedRun.body.jobId,
      presetId,
      outputURL: join(temporaryRoot, "cross-project.mp4"),
    }),
  });
  expectStatus(crossProjectExport.response.status, 404, crossProjectExport.body);

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
} finally {
  engine.kill("SIGTERM");
  await Promise.race([engine.exited, Bun.sleep(5000)]);
  if (!process.argv.includes("--keep")) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
