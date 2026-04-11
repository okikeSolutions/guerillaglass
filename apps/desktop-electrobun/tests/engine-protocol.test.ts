import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import {
  agentStatusResultSchema,
  buildRequest,
  capabilitiesResultSchema,
  captureStartCurrentWindowRequestSchema,
  captureStartDisplayRequestSchema,
  capturePreviewFrameResultSchema,
  captureStatusResultSchema,
  engineRequestSchema,
  exportInfoResultSchema,
  importedTranscriptSchema,
  parseResponse,
  permissionsResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine-protocol";

const captureTelemetryFixture = {
  sourceDroppedFrames: 0,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  achievedFps: 0,
  cpuPercent: null,
  memoryBytes: null,
  recordingBitrateMbps: null,
  captureCallbackMs: 0,
  recordQueueLagMs: 0,
  writerAppendMs: 0,
  previewEncodeMs: 0,
};

function decodeSchemaSync<S extends Schema.Schema.Any>(
  schema: S,
  raw: unknown,
): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(raw) as Schema.Schema.Type<S>;
}

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

    expect(decodeSchemaSync(engineRequestSchema, capabilitiesRequest).method).toBe(
      "engine.capabilities",
    );
    expect(decodeSchemaSync(engineRequestSchema, saveRequest).method).toBe("project.save");
    expect(decodeSchemaSync(engineRequestSchema, recentsRequest).method).toBe("project.recents");
    expect(
      decodeSchemaSync(importedTranscriptSchema, importedTranscriptValid).segments.length,
    ).toBeGreaterThan(0);
    expect(() => decodeSchemaSync(importedTranscriptSchema, importedTranscriptInvalid)).toThrow();
  });

  test("builds and validates parity method requests", () => {
    const capabilitiesRequest = buildRequest("engine.capabilities", {});
    const startDisplayRequest = buildRequest("capture.startDisplay", {
      displayId: 1,
      enableMic: false,
      enablePreview: false,
      captureFps: 60,
    });
    const startCurrentWindowRequest = buildRequest("capture.startCurrentWindow", {
      enableMic: false,
      enablePreview: true,
      captureFps: 120,
    });
    const startRecordingRequest = buildRequest("recording.start", { trackInputEvents: true });
    const capturePreviewFrameRequest = buildRequest("capture.previewFrame", {});
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
      timeline: {
        version: 1,
        segments: [
          {
            id: "segment-0",
            sourceAssetId: "recording",
            sourceStartSeconds: 0,
            sourceEndSeconds: 3,
          },
        ],
      },
    });
    const recentsRequest = buildRequest("project.recents", {
      limit: 5,
    });
    const decodedStartDisplayRequest = decodeSchemaSync(
      captureStartDisplayRequestSchema,
      startDisplayRequest,
    );
    const decodedStartCurrentWindowRequest = decodeSchemaSync(
      captureStartCurrentWindowRequestSchema,
      startCurrentWindowRequest,
    );

    expect(decodeSchemaSync(engineRequestSchema, capabilitiesRequest).method).toBe(
      "engine.capabilities",
    );
    expect(decodedStartDisplayRequest.method).toBe("capture.startDisplay");
    expect(decodedStartDisplayRequest.params.enablePreview).toBe(false);
    expect(decodedStartCurrentWindowRequest.params.enablePreview).toBe(true);
    expect(decodedStartCurrentWindowRequest.method).toBe("capture.startCurrentWindow");
    expect(decodeSchemaSync(engineRequestSchema, startRecordingRequest).method).toBe(
      "recording.start",
    );
    expect(decodeSchemaSync(engineRequestSchema, capturePreviewFrameRequest).method).toBe(
      "capture.previewFrame",
    );
    expect(decodeSchemaSync(engineRequestSchema, agentPreflightRequest).method).toBe(
      "agent.preflight",
    );
    expect(decodeSchemaSync(engineRequestSchema, agentRunRequest).method).toBe("agent.run");
    expect(decodeSchemaSync(engineRequestSchema, agentApplyRequest).method).toBe("agent.apply");
    expect(decodeSchemaSync(engineRequestSchema, runCutPlanRequest).method).toBe(
      "export.runCutPlan",
    );
    expect(decodeSchemaSync(engineRequestSchema, saveProjectRequest).method).toBe("project.save");
    expect(decodeSchemaSync(engineRequestSchema, recentsRequest).method).toBe("project.recents");
  });

  test("validates critical result payloads", () => {
    const capabilities = decodeSchemaSync(capabilitiesResultSchema, {
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

    const permissions = decodeSchemaSync(permissionsResultSchema, {
      screenRecordingGranted: true,
      microphoneGranted: false,
      inputMonitoring: "notDetermined",
    });

    const sources = decodeSchemaSync(sourcesResultSchema, {
      displays: [
        {
          id: 1,
          displayName: "Built-in Display",
          isPrimary: true,
          width: 3024,
          height: 1964,
          pixelScale: 1,
          refreshHz: 120,
          supportedCaptureFrameRates: [24, 30, 60, 120],
        },
      ],
      windows: [
        {
          id: 42,
          title: "Simulator",
          appName: "Xcode",
          width: 1280,
          height: 720,
          isOnScreen: true,
          pixelScale: 1,
          refreshHz: 60,
          supportedCaptureFrameRates: [24, 30, 60],
        },
      ],
    });

    const captureStatus = decodeSchemaSync(captureStatusResultSchema, {
      isRunning: false,
      isRecording: false,
      captureSessionId: null,
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
      lastRecordingTelemetry: null,
      telemetry: captureTelemetryFixture,
    });

    const capturePreviewFrame = decodeSchemaSync(capturePreviewFrameResultSchema, {
      frameId: 12,
      bytesBase64: "ZmFrZS1wcmV2aWV3LWJ5dGVz",
    });

    const exportInfo = decodeSchemaSync(exportInfoResultSchema, {
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

    const projectState = decodeSchemaSync(projectStateSchema, {
      projectPath: "/tmp/project.gglassproj",
      recordingURL: "/tmp/project.gglassproj/recording.mov",
      eventsURL: null,
      lastRecordingTelemetry: {
        sourceDroppedFrames: 1,
        writerDroppedFrames: 0,
        writerBackpressureDrops: 0,
        achievedFps: 28.7,
        cpuPercent: 9.8,
        memoryBytes: 300_000_000,
        recordingBitrateMbps: 8.1,
        captureCallbackMs: 0.35,
        recordQueueLagMs: 0.12,
        writerAppendMs: 0.81,
      },
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

    const recents = decodeSchemaSync(projectRecentsResultSchema, {
      items: [
        {
          projectPath: "/tmp/project.gglassproj",
          displayName: "project",
          lastOpenedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
    });
    const blockedAgentStatus = decodeSchemaSync(agentStatusResultSchema, {
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
    expect(sources.displays[0]?.supportedCaptureFrameRates).toEqual([24, 30, 60, 120]);
    expect(sources.displays[0]?.displayName).toBe("Built-in Display");
    expect(sources.displays[0]?.isPrimary).toBe(true);
    expect(sources.displays[0]?.pixelScale).toBe(1);
    expect(sources.windows[0]?.pixelScale).toBe(1);
    expect(sources.windows[0]?.appName).toBe("Xcode");
    expect(captureStatus.eventsURL).toBeNull();
    expect(captureStatus.captureSessionId).toBeNull();
    expect(captureStatus.captureMetadata?.source).toBe("window");
    expect(captureStatus.captureMetadata?.window?.id).toBe(42);
    expect(capturePreviewFrame?.frameId).toBe(12);
    expect(projectState.lastRecordingTelemetry?.achievedFps).toBe(28.7);
    expect(exportInfo.presets.length).toBe(1);
    expect(projectState.projectPath).toContain("project.gglassproj");
    expect(projectState.timeline.segments).toEqual([]);
    expect(projectState.agentAnalysis.latestJobId).toBe("job-123");
    expect(blockedAgentStatus.blockingReason).toBe("weak_narrative_structure");
    expect(recents.items[0]?.displayName).toBe("project");
  });

  test("fills telemetry defaults when payload is missing", () => {
    const captureStatus = decodeSchemaSync(captureStatusResultSchema, {
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      lastError: null,
      eventsURL: null,
      lastRecordingTelemetry: {
        achievedFps: 29.2,
      },
    });

    expect(captureStatus.telemetry).toEqual({
      sourceDroppedFrames: 0,
      writerDroppedFrames: 0,
      writerBackpressureDrops: 0,
      achievedFps: 0,
      cpuPercent: null,
      memoryBytes: null,
      recordingBitrateMbps: null,
      captureCallbackMs: 0,
      recordQueueLagMs: 0,
      writerAppendMs: 0,
      previewEncodeMs: 0,
    });
    expect(captureStatus.captureSessionId).toBeNull();
  });

  test("accepts timeline-backed export payloads", () => {
    const exportRequest = buildRequest("export.run", {
      outputURL: "/tmp/out.mp4",
      presetId: "h264-1080p-30",
      timeline: {
        version: 1,
        segments: [
          {
            id: "segment-a",
            sourceAssetId: "recording",
            sourceStartSeconds: 1,
            sourceEndSeconds: 4,
          },
        ],
      },
    });

    expect(decodeSchemaSync(engineRequestSchema, exportRequest).method).toBe("export.run");
  });

  test("fills telemetry defaults when payload is partial", () => {
    const captureStatus = decodeSchemaSync(captureStatusResultSchema, {
      isRunning: true,
      isRecording: false,
      captureSessionId: "capture-session-1",
      recordingDurationSeconds: 0.5,
      recordingURL: null,
      lastError: null,
      eventsURL: null,
      lastRecordingTelemetry: {
        sourceDroppedFrames: 2,
        writerDroppedFrames: 0,
        writerBackpressureDrops: 0,
        achievedFps: 29.2,
        cpuPercent: null,
        memoryBytes: null,
        recordingBitrateMbps: null,
        captureCallbackMs: 0,
        recordQueueLagMs: 0,
        writerAppendMs: 0,
      },
      telemetry: {
        achievedFps: 59.2,
      },
    });

    expect(captureStatus.telemetry.achievedFps).toBe(59.2);
    expect(captureStatus.captureSessionId).toBe("capture-session-1");
    expect(captureStatus.telemetry.writerDroppedFrames).toBe(0);
    expect(captureStatus.telemetry.cpuPercent).toBeNull();
    expect(captureStatus.lastRecordingTelemetry?.achievedFps).toBe(29.2);
  });

  test("rejects invalid ISO datetime fields in engine payloads", () => {
    expect(() =>
      decodeSchemaSync(projectRecentsResultSchema, {
        items: [
          {
            projectPath: "/tmp/project.gglassproj",
            displayName: "project",
            lastOpenedAt: "yesterday",
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      decodeSchemaSync(projectRecentsResultSchema, {
        items: [
          {
            projectPath: "/tmp/project.gglassproj",
            displayName: "project",
            lastOpenedAt: "2026-02-30T10:00:00.000Z",
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      decodeSchemaSync(agentStatusResultSchema, {
        jobId: "job-456",
        status: "blocked",
        runtimeBudgetMinutes: 10,
        qaReport: null,
        blockingReason: "weak_narrative_structure",
        updatedAt: "2026-02-25 10:00:00.000Z",
      }),
    ).toThrow();
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
    const recents = decodeSchemaSync(projectRecentsResultSchema, recentsEnvelope.result);

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
    expect(recents.items[0]?.projectPath).toContain("fixture.gglassproj");
  });
});
