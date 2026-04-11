import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { enUS } from "@guerillaglass/localization";
import { StudioTechnicalFeedbackStrip } from "@studio/layout/StudioTechnicalFeedbackStrip";
import { StudioProvider } from "@studio/state/StudioProvider";
import type { StudioController } from "@studio/hooks/core/useStudioController";

const telemetryFixture = {
  sourceDroppedFrames: 1,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  achievedFps: 28.4,
  cpuPercent: 11.2,
  memoryBytes: 314_572_800,
  recordingBitrateMbps: 8.5,
  captureCallbackMs: 0.4,
  recordQueueLagMs: 0.2,
  writerAppendMs: 0.7,
  previewEncodeMs: 0.1,
};

function makeStudioMock(overrides: Partial<StudioController> = {}): StudioController {
  return {
    activeMode: "edit",
    captureStatusQuery: {
      data: {
        isRunning: false,
        isRecording: false,
        captureSessionId: null,
        recordingDurationSeconds: 10,
        recordingURL: "/tmp/recording.mov",
        captureMetadata: null,
        lastError: null,
        eventsURL: null,
        lastRecordingTelemetry: null,
        telemetry: telemetryFixture,
      },
    },
    formatDecimal: (value: number) => value.toFixed(2),
    formatInteger: (value: number) => String(Math.round(value)),
    projectQuery: {
      data: {
        projectPath: "/tmp/project.gglassproj",
        recordingURL: "/tmp/recording.mov",
        eventsURL: null,
        lastRecordingTelemetry: telemetryFixture,
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        timeline: {
          version: 1,
          segments: [],
        },
        captureMetadata: null,
        agentAnalysis: {
          latestJobId: null,
          latestStatus: null,
          qaPassed: null,
          updatedAt: null,
        },
      },
    },
    ui: enUS,
    ...overrides,
  } as unknown as StudioController;
}

function render(controller: StudioController): string {
  return renderToStaticMarkup(
    <StudioProvider value={controller}>
      <StudioTechnicalFeedbackStrip />
    </StudioProvider>,
  );
}

describe("studio technical feedback strip", () => {
  test("renders last completed recording summary on edit", () => {
    const html = render(makeStudioMock());

    expect(html).toContain("Achieved FPS");
    expect(html).toContain("28.40 fps");
    expect(html).toContain("CPU");
  });

  test("hides telemetry on edit while capture is still active", () => {
    const html = render(
      makeStudioMock({
        captureStatusQuery: {
          data: {
            isRunning: true,
            isRecording: true,
            captureSessionId: "capture-session-1",
            recordingDurationSeconds: 2,
            recordingURL: "/tmp/recording.mov",
            captureMetadata: null,
            lastError: null,
            eventsURL: null,
            lastRecordingTelemetry: telemetryFixture,
            telemetry: telemetryFixture,
          },
        } as unknown as StudioController["captureStatusQuery"],
      }),
    );

    expect(html).toBe("");
  });

  test("renders last completed recording summary on capture after recording stops", () => {
    const html = render(
      makeStudioMock({
        activeMode: "capture",
        captureStatusQuery: {
          data: {
            isRunning: false,
            isRecording: false,
            captureSessionId: null,
            recordingDurationSeconds: 10,
            recordingURL: "/tmp/recording.mov",
            captureMetadata: null,
            lastError: null,
            eventsURL: null,
            lastRecordingTelemetry: telemetryFixture,
            telemetry: telemetryFixture,
          },
        } as unknown as StudioController["captureStatusQuery"],
      }),
    );

    expect(html).toContain("Achieved FPS");
    expect(html).toContain("28.40 fps");
  });
});
