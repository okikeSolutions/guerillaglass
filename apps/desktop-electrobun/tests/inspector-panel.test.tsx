import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { enUS } from "@guerillaglass/localization";
import { InspectorPanel } from "../src/mainview/app/studio/panels/InspectorPanel";
import { StudioProvider } from "../src/mainview/app/studio/state/StudioProvider";
import type {
  InspectorSelection,
  StudioMode,
} from "../src/mainview/app/studio/model/inspectorSelectionModel";
import type { StudioController } from "../src/mainview/app/studio/hooks/core/useStudioController";

function makeStudioMock(selection: InspectorSelection): StudioController {
  const settingsValues = {
    captureSource: "window" as const,
    selectedWindowId: 42,
    captureFps: 60 as const,
    micEnabled: true,
    trackInputEvents: true,
    singleKeyShortcutsEnabled: true,
    autoZoom: {
      isEnabled: true,
      intensity: 1,
      minimumKeyframeInterval: 1 / 30,
    },
  };

  return {
    audioMixer: {
      masterGain: 0.8,
      masterMuted: false,
      micGain: 0.9,
      micMuted: false,
    },
    captureStatusQuery: {
      data: {
        telemetry: null,
      },
    },
    exportForm: {
      state: {
        values: {
          trimStartSeconds: 1.25,
          trimEndSeconds: 8.5,
        },
      },
    },
    formatAspectRatio: (width: number, height: number) => `${width}:${height}`,
    formatDecimal: (value: number) => value.toFixed(2),
    formatInteger: (value: number) => String(Math.round(value)),
    inspectorSelection: selection,
    setAudioMixerGain: () => {},
    setPlayheadSeconds: () => {},
    setTrimEndSeconds: () => {},
    setTrimStartSeconds: () => {},
    selectedPreset: {
      id: "preset-1",
      name: "1080p",
      width: 1920,
      height: 1080,
      frameRate: 60,
      videoBitRate: 8_000_000,
      audioBitRate: 192_000,
      fileType: "mp4",
    },
    settingsForm: {
      state: {
        values: settingsValues,
      },
      Field: ({
        name,
        children,
      }: {
        name: keyof typeof settingsValues;
        children: (field: {
          state: { value: unknown };
          handleChange: (nextValue: unknown) => void;
        }) => unknown;
      }) =>
        children({
          state: { value: settingsValues[name] },
          handleChange: () => {},
        }),
    },
    toggleAudioMixerMuted: () => {},
    ui: enUS,
  } as unknown as StudioController;
}

function render(mode: StudioMode, selection: InspectorSelection): string {
  return renderToStaticMarkup(
    <StudioProvider value={makeStudioMock(selection)}>
      <InspectorPanel mode={mode} />
    </StudioProvider>,
  );
}

describe("inspector panel", () => {
  test("renders mode-default content when selection is empty", () => {
    const html = render("deliver", { kind: "none" });
    expect(html).toContain("Deliver Inspector");
    expect(html).toContain("Active Preset");
    expect(html).toContain("Trim Window");
  });

  test("renders clip-focused inspector for timeline clip selection", () => {
    const html = render("deliver", {
      kind: "timelineClip",
      laneId: "video",
      clipId: "clip-0",
      startSeconds: 0,
      endSeconds: 5,
    });
    expect(html).toContain("Video Clip Inspector");
    expect(html).toContain("Selected Clip");
    expect(html).toContain("Lane: Video");
    expect(html).toContain("Set Trim In To Clip Start");
    expect(html).not.toContain("Trim Window");
    expect(html).not.toContain("Active Preset");
  });

  test("renders preset-focused details while keeping deliver controls", () => {
    const html = render("deliver", {
      kind: "exportPreset",
      presetId: "preset-1",
      name: "1080p",
      width: 1920,
      height: 1080,
      fileType: "mp4",
    });
    expect(html).toContain("Preset Inspector");
    expect(html).toContain("Selected Preset");
    expect(html).toContain("File Type: mp4");
    expect(html).toContain("Active Preset");
    expect(html).toContain("Trim Window");
  });

  test("renders capture-window details while keeping capture controls", () => {
    const html = render("capture", {
      kind: "captureWindow",
      windowId: 42,
      appName: "Safari",
      title: "Docs",
    });
    expect(html).toContain("Window Inspector");
    expect(html).toContain("Selected Window");
    expect(html).toContain("Window ID: 42");
    expect(html).toContain("CAPTURE");
    expect(html).toContain("EFFECTS");
  });
});
