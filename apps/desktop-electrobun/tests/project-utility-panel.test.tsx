import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectUtilityPanel } from "../src/mainview/app/routes/ProjectUtilityPanel";
import { StudioProvider } from "../src/mainview/app/studio/context";
import type { StudioController } from "../src/mainview/app/studio/useStudioController";
import { enUS } from "../src/mainview/i18n/en";

type PanelOptions = {
  pendingRecents?: boolean;
  recentItems?: Array<{
    projectPath: string;
    displayName: string;
    lastOpenedAt: string;
  }>;
};

function makeStudioMock(options?: PanelOptions): StudioController {
  const recentItems = options?.recentItems ?? [
    {
      projectPath: "/tmp/alpha.gglassproj",
      displayName: "Alpha",
      lastOpenedAt: "2026-02-19T10:00:00.000Z",
    },
  ];

  return {
    captureStatusQuery: {
      data: {
        recordingDurationSeconds: 12,
        eventsURL: "/tmp/alpha.gglassproj/events.json",
      },
    },
    formatDateTime: (value: string) => value,
    formatDecimal: (value: number) => value.toFixed(2),
    formatDuration: () => "00:00:12",
    formatInteger: (value: number) => `${Math.round(value)}`,
    isRunningAction: false,
    openProjectMutation: {
      mutateAsync: async () => null,
    },
    openRecentProjectMutation: {
      mutateAsync: async () => null,
    },
    projectQuery: {
      data: {
        projectPath: "/tmp/alpha.gglassproj",
        eventsURL: "/tmp/alpha.gglassproj/events.json",
        captureMetadata: {
          source: "window",
          contentRect: {
            x: 0,
            y: 0,
            width: 1280,
            height: 720,
          },
          pixelScale: 2,
        },
      },
    },
    projectRecentsQuery: {
      isPending: options?.pendingRecents ?? false,
      data: {
        items: recentItems,
      },
    },
    recordingURL: "/tmp/alpha.gglassproj/recording.mov",
    saveProjectMutation: {
      mutateAsync: async () => null,
    },
    ui: enUS,
  } as unknown as StudioController;
}

function renderPanel(options?: PanelOptions): string {
  return renderToStaticMarkup(
    <StudioProvider value={makeStudioMock(options)}>
      <ProjectUtilityPanel />
    </StudioProvider>,
  );
}

describe("project utility panel", () => {
  test("renders active project metadata and recent entries", () => {
    const html = renderPanel();

    expect(html).toContain("Active Project");
    expect(html).toContain("Project Name: alpha");
    expect(html).toContain("Capture Source: window");
    expect(html).toContain("Capture Resolution: 1280x720");
    expect(html).toContain("Recent Projects");
    expect(html).toContain("Alpha");
    expect(html).toContain("Open Recent");
  });

  test("renders loading state for recent projects", () => {
    const html = renderPanel({ pendingRecents: true });

    expect(html).toContain("Loading recent projects...");
  });

  test("renders empty state when there are no recent projects", () => {
    const html = renderPanel({ recentItems: [] });

    expect(html).toContain("No recent projects yet");
  });
});
