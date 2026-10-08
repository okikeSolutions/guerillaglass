import { describe, expect, it } from "vitest";
import type { ShortcutDisplayPlatform } from "@shared/shortcuts";
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

  it("builds utility actions with disabled states based on recording availability", () => {
    const studio = createStudioStub();
    const actions = buildUtilityActions(studio, "mac" satisfies ShortcutDisplayPlatform, "/edit");

    const saveAction = actions.find((action) => action.id === "save");
    const exportAction = actions.find((action) => action.id === "export");
    const timelineAction = actions.find((action) => action.id === "toggle-timeline");

    expect(saveAction?.disabled).toBe(true);
    expect(exportAction?.disabled).toBe(true);
    expect(timelineAction).toBeDefined();
    expect(saveAction?.title).toBe("Recording required");
    expect(exportAction?.title).toBe("Recording required");
  });

  it("omits the timeline action on capture route", () => {
    const studio = createStudioStub();
    const actions = buildUtilityActions(
      studio,
      "mac" satisfies ShortcutDisplayPlatform,
      "/capture",
    );

    expect(actions.find((action) => action.id === "toggle-timeline")).toBeUndefined();
  });

  it("uses current-window capture for the main window quick-record action", () => {
    expect(resolveConfiguredRecordingOptions("window")).toEqual({
      captureSourceOverride: "window",
      preferCurrentWindow: true,
    });
    expect(resolveConfiguredRecordingOptions("display")).toEqual({
      captureSourceOverride: "display",
    });
  });
});
