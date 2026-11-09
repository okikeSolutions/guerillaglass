import { describe, expect, it } from "vitest";
import { enUS } from "@shared/localization";
import {
  buildModeItems,
  buildUtilityActions,
  resolveConfiguredRecordingOptions,
} from "@studio/layout/StudioShellHeader";

type HeaderStudio = Parameters<typeof buildModeItems>[0];

function createStudioStub(): HeaderStudio {
  return {
    ui: {
      modes: enUS.modes,
      actions: enUS.actions,
    },
    isRunningAction: false,
    isRefreshing: false,
    recordingURL: null,
    recordingRequiredNotice: "Recording required",
    refreshAll: async () => undefined,
    saveProjectMutation: {
      mutateAsync: async () => undefined,
    },
    exportMutation: {
      mutateAsync: async () => undefined,
    },
    shortcutOverrides: {},
    toggleLeftPaneCollapsed: () => void 0,
    toggleRightPaneCollapsed: () => void 0,
    toggleTimelineCollapsed: () => void 0,
    resetLayout: () => void 0,
  };
}

describe("studio shell header builders", () => {
  it("builds mode items with active route", () => {
    const studio = createStudioStub();
    const items = buildModeItems(studio, "/edit");

    expect(items).toHaveLength(3);
    expect(items.find((item) => item.route === "/edit")?.active).toBe(true);
    expect(items.find((item) => item.route === "/capture")?.active).toBe(false);
  });

  it("keeps file commands out of View utilities and disables pending refresh", () => {
    const studio = createStudioStub();
    const refreshing = { ...studio, isRefreshing: true };
    const actions = buildUtilityActions(refreshing, "/edit");
    expect(actions.map((action) => action.id)).toEqual([
      "refresh",
      "toggle-left-pane",
      "toggle-right-pane",
      "toggle-timeline",
      "reset-layout",
    ]);
    expect(actions.find((action) => action.id === "refresh")?.disabled).toBe(true);
    expect(actions.some((action) => action.id === "save" || action.id === "export")).toBe(false);
  });

  it("omits the timeline action on capture route", () => {
    const studio = createStudioStub();
    const actions = buildUtilityActions(studio, "/capture");

    expect(actions.find((action) => action.id === "toggle-timeline")).toBeUndefined();
  });

  it("respects the configured source without silently preferring the current window", () => {
    expect(resolveConfiguredRecordingOptions("window")).toEqual({
      captureSourceOverride: "window",
    });
    expect(resolveConfiguredRecordingOptions("display")).toEqual({
      captureSourceOverride: "display",
    });
  });
});
