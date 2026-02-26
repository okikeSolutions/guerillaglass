import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  agentStatusResultSchema,
  buildRequest,
  capabilitiesResultSchema,
  captureStatusResultSchema,
  defaultCaptureTelemetry,
  engineRequestSchema,
  exportInfoResultSchema,
  importedTranscriptSchema,
  parseResponse,
  permissionsResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine-protocol";

describe("engine protocol", () => {
  test("parses shared contract fixtures", () => {
    const fixtureDir = path.resolve(import.meta.dir, "../../../packages/engine-protocol/fixtures");
    const capabilitiesRaw = fs.readFileSync(
      path.join(fixtureDir, "engine-capabilities.request.json"),
      "utf8",
    );
    const saveRaw = fs.readFileSync(path.join(fixtureDir, "project-save.request.json"), "utf8");
    const recentsRaw = fs.readFileSync(
      path.join(fixtureDir, "project-recents.request.json"),
      "utf8",
    );
    const importedTranscriptValidRaw = fs.readFileSync(
      path.join(fixtureDir, "imported-transcript.valid.json"),
      "utf8",
    );
    const importedTranscriptInvalidRaw = fs.readFileSync(
      path.join(fixtureDir, "imported-transcript.invalid.json"),
      "utf8",
    );

    const capabilitiesRequest = JSON.parse(capabilitiesRaw);
    const saveRequest = JSON.parse(saveRaw);
    const recentsRequest = JSON.parse(recentsRaw);
    const importedTranscriptValid = JSON.parse(importedTranscriptValidRaw);
    const importedTranscriptInvalid = JSON.parse(importedTranscriptInvalidRaw);

    expect(engineRequestSchema.parse(capabilitiesRequest).method).toBe("engine.capabilities");
    expect(engineRequestSchema.parse(saveRequest).method).toBe("project.save");
    expect(engineRequestSchema.parse(recentsRequest).method).toBe("project.recents");
    expect(importedTranscriptSchema.parse(importedTranscriptValid).segments.length).toBeGreaterThan(
      0,
    );
    expect(() => importedTranscriptSchema.parse(importedTranscriptInvalid)).toThrow();
  });

  test("builds and validates parity method requests", () => {
    const capabilitiesRequest = buildRequest("engine.capabilities", {});
    const startCurrentWindowRequest = buildRequest("capture.startCurrentWindow", {
      enableMic: false,
      captureFps: 30,
    });
    const startRecordingRequest = buildRequest("recording.start", { trackInputEvents: true });
    const agentPreflightRequest = buildRequest("agent.preflight", {
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "none",
    });
    const agentRunRequest = buildRequest("agent.run", {
      preflightToken: "preflight-token-123",
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "none",
      force: false,
    });
    const agentApplyRequest = buildRequest("agent.apply", {
      jobId: "job-123",
      destructiveIntent: true,
    });
    const runCutPlanRequest = buildRequest("export.runCutPlan", {
      outputURL: "/tmp/export.mp4",
      presetId: "h264-1080p-30",
      jobId: "job-123",
    });
    const saveProjectRequest = buildRequest("project.save", {
      projectPath: "/tmp/test.gglassproj",
      autoZoom: {
        isEnabled: true,
        intensity: 0.8,
        minimumKeyframeInterval: 1 / 30,
      },
    });
    const recentsRequest = buildRequest("project.recents", {
      limit: 5,
    });

    expect(engineRequestSchema.parse(capabilitiesRequest).method).toBe("engine.capabilities");
    expect(engineRequestSchema.parse(startCurrentWindowRequest).method).toBe(
      "capture.startCurrentWindow",
    );
    expect(engineRequestSchema.parse(startRecordingRequest).method).toBe("recording.start");
    expect(engineRequestSchema.parse(agentPreflightRequest).method).toBe("agent.preflight");
    expect(engineRequestSchema.parse(agentRunRequest).method).toBe("agent.run");
    expect(engineRequestSchema.parse(agentApplyRequest).method).toBe("agent.apply");
    expect(engineRequestSchema.parse(runCutPlanRequest).method).toBe("export.runCutPlan");
    expect(engineRequestSchema.parse(saveProjectRequest).method).toBe("project.save");
    expect(engineRequestSchema.parse(recentsRequest).method).toBe("project.recents");
  });

  test("validates critical result payloads", () => {
    const capabilities = capabilitiesResultSchema.parse({
      protocolVersion: "2",
      platform: "linux",
      phase: "foundation",
      capture: {
        display: true,
        window: true,
        systemAudio: true,
        microphone: true,
      },
      recording: {
        inputTracking: true,
      },
      export: {
        presets: true,
        cutPlan: true,
      },
      project: {
        openSave: true,
      },
      agent: {
        preflight: true,
        run: true,
        status: true,
        apply: true,
        localOnly: true,
        runtimeBudgetMinutes: 10,
      },
    });

    const permissions = permissionsResultSchema.parse({
      screenRecordingGranted: true,
      microphoneGranted: false,
      inputMonitoring: "notDetermined",
    });

    const sources = sourcesResultSchema.parse({
      displays: [{ id: 1, width: 3024, height: 1964 }],
      windows: [
        {
          id: 42,
          title: "Simulator",
          appName: "Xcode",
          width: 1280,
          height: 720,
          isOnScreen: true,
        },
      ],
    });

    const captureStatus = captureStatusResultSchema.parse({
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      captureMetadata: {
        source: "window",
        window: {
          id: 42,
          title: "Simulator",
          appName: "Xcode",
        },
        contentRect: {
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
        },
        pixelScale: 2,
      },
      lastError: null,
      eventsURL: null,
      telemetry: { ...defaultCaptureTelemetry },
    });

    const exportInfo = exportInfoResultSchema.parse({
      presets: [
        {
          id: "h264-1080p-30",
          name: "1080p 30fps",
          width: 1920,
          height: 1080,
          fps: 30,
          fileType: "mp4",
        },
      ],
    });

    const projectState = projectStateSchema.parse({
      projectPath: "/tmp/project.gglassproj",
      recordingURL: "/tmp/project.gglassproj/recording.mov",
      eventsURL: null,
      autoZoom: {
        isEnabled: true,
        intensity: 1,
        minimumKeyframeInterval: 1 / 30,
      },
      captureMetadata: null,
      agentAnalysis: {
        latestJobId: "job-123",
        latestStatus: "completed",
        qaPassed: true,
        updatedAt: "2026-02-25T10:00:00.000Z",
      },
    });

    const recents = projectRecentsResultSchema.parse({
      items: [
        {
          projectPath: "/tmp/project.gglassproj",
          displayName: "project",
          lastOpenedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
    });
    const blockedAgentStatus = agentStatusResultSchema.parse({
      jobId: "job-456",
      status: "blocked",
      runtimeBudgetMinutes: 10,
      qaReport: {
        passed: false,
        score: 0.25,
        coverage: {
          hook: true,
          action: false,
          payoff: false,
          takeaway: false,
        },
        missingBeats: ["action", "payoff", "takeaway"],
      },
      blockingReason: "weak_narrative_structure",
      updatedAt: "2026-02-25T10:00:00.000Z",
    });

    expect(capabilities.capture.display).toBe(true);
    expect(permissions.inputMonitoring).toBe("notDetermined");
    expect(sources.windows[0]?.appName).toBe("Xcode");
    expect(captureStatus.eventsURL).toBeNull();
    expect(captureStatus.captureMetadata?.source).toBe("window");
    expect(captureStatus.captureMetadata?.window?.id).toBe(42);
    expect(exportInfo.presets.length).toBe(1);
    expect(projectState.projectPath).toContain("project.gglassproj");
    expect(projectState.agentAnalysis.latestJobId).toBe("job-123");
    expect(blockedAgentStatus.blockingReason).toBe("weak_narrative_structure");
    expect(recents.items[0]?.displayName).toBe("project");
  });

  test("applies default telemetry when older engines omit it", () => {
    const captureStatus = captureStatusResultSchema.parse({
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      lastError: null,
      eventsURL: null,
    });

    expect(captureStatus.telemetry.health).toBe("good");
    expect(captureStatus.telemetry.healthReason).toBeNull();
    expect(captureStatus.telemetry.droppedFrames).toBe(0);
    expect(captureStatus.telemetry.sourceDroppedFrames).toBe(0);
    expect(captureStatus.telemetry.writerDroppedFrames).toBe(0);
    expect(captureStatus.telemetry.achievedFps).toBe(0);
    expect(captureStatus.captureMetadata).toBeNull();
  });

  test("parses success and error response envelopes", () => {
    const fixtureDir = path.resolve(import.meta.dir, "../../../packages/engine-protocol/fixtures");
    const recentsResponseRaw = fs.readFileSync(
      path.join(fixtureDir, "project-recents.response.json"),
      "utf8",
    );

    const success = parseResponse({
      id: "abc",
      ok: true,
      result: {
        healthy: true,
      },
    });

    const failure = parseResponse({
      id: "def",
      ok: false,
      error: {
        code: "runtime_error",
        message: "boom",
      },
    });
    const recentsEnvelope = parseResponse(JSON.parse(recentsResponseRaw));
    if (!recentsEnvelope.ok) {
      throw new Error("Expected recents response fixture to be successful");
    }
    const recents = projectRecentsResultSchema.parse(recentsEnvelope.result);

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
    expect(recents.items[0]?.projectPath).toContain("fixture.gglassproj");
  });
});
