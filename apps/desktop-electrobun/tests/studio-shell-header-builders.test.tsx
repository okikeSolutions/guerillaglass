import { describe, expect, it } from "bun:test";
import type { ShortcutDisplayPlatform } from "../src/shared/shortcuts";
import {
  buildModeItems,
  buildTelemetryBadges,
  buildUtilityActions,
} from "../src/mainview/app/studio/layout/StudioShellHeader";

type HeaderStudio = Parameters<typeof buildTelemetryBadges>[0];

function createStudioStub(): HeaderStudio {
  return {
    ui: {
      modes: {
        capture: "Capture",
        edit: "Edit",
        deliver: "Deliver",
      },
      labels: {
        status: "Status",
        duration: "Duration",
        droppedFrames: "Dropped Frames",
        audioLevel: "Audio",
        health: "Health",
      },
      values: {
        good: "Good",
        warning: "Warning",
        critical: "Critical",
      },
      helper: {
        healthReasonEngineError: "Engine Error",
        healthReasonHighDroppedFrameRate: "High Dropped Frame Rate",
        healthReasonElevatedDroppedFrameRate: "Elevated Dropped Frame Rate",
        healthReasonLowMicrophoneLevel: "Low Microphone Level",
      },
      actions: {
        refresh: "Refresh",
        saveProject: "Save",
        exportNow: "Export",
        toggleLeftPane: "Toggle Left",
        toggleRightPane: "Toggle Right",
        toggleTimeline: "Toggle Timeline",
        resetLayout: "Reset Layout",
      },
    },
    captureStatusQuery: {
      data: {
        recordingDurationSeconds: 19,
        telemetry: {
          achievedFps: 30,
          droppedFrames: 3,
          sourceDroppedFrames: 2,
          writerDroppedFrames: 1,
          writerBackpressureDrops: 0,
          audioLevelDbfs: -8,
          health: "warning",
          healthReason: "low_microphone_level",
        },
      },
    },
    captureStatusLabel: "Ready",
    formatInteger: (value: number) => String(Math.round(value)),
    formatDecimal: (value: number) => value.toFixed(2),
    formatDuration: (seconds: number) => `00:00:${String(seconds).padStart(2, "0")}`,
    isRunningAction: false,
    isRefreshing: false,
    recordingURL: null,
    recordingRequiredNotice: "Recording required",
    refreshAll: () => Promise.resolve(),
    saveProjectMutation: {
      mutateAsync: () => Promise.resolve(),
    },
    exportMutation: {
      mutateAsync: () => Promise.resolve(),
    },
    toggleLeftPaneCollapsed: () => void 0,
    toggleRightPaneCollapsed: () => void 0,
    toggleTimelineCollapsed: () => void 0,
    resetLayout: () => void 0,
  } as unknown as HeaderStudio;
}

describe("studio shell header builders", () => {
  it("builds mode items with active route", () => {
    const studio = createStudioStub();
    const items = buildModeItems(studio, "/edit");

    expect(items).toHaveLength(3);
    expect(items.find((item) => item.route === "/edit")?.active).toBe(true);
    expect(items.find((item) => item.route === "/capture")?.active).toBe(false);
  });

  it("builds telemetry badges with stable ids and localized health reason", () => {
    const studio = createStudioStub();
    const badges = buildTelemetryBadges(studio);

    expect(badges.map((badge) => badge.id)).toEqual([
      "status",
      "duration",
      "dropped-frames",
      "audio-level",
      "health",
    ]);
    expect(badges.find((badge) => badge.id === "health")?.tooltip).toContain(
      "Low Microphone Level",
    );
  });

  it("builds utility actions with disabled states based on recording availability", () => {
    const studio = createStudioStub();
    const actions = buildUtilityActions(studio, "mac" satisfies ShortcutDisplayPlatform);

    const saveAction = actions.find((action) => action.id === "save");
    const exportAction = actions.find((action) => action.id === "export");

    expect(saveAction?.disabled).toBe(true);
    expect(exportAction?.disabled).toBe(true);
    expect(saveAction?.title).toBe("Recording required");
    expect(exportAction?.title).toBe("Recording required");
  });
});
