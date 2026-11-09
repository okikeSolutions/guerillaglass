import { useEffect, useRef } from "react";
import * as m from "../../../../paraglide/messages.js";
import { formatCaptureTargetLabelFromMetadata } from "../view-model/captureTargetLabelFormatter";
import { FolderClock, FolderOpen } from "lucide-react";
import { Button } from "@guerillaglass/ui/components/button";
import { DesktopPanelCard, DesktopPanelDetailRows } from "@guerillaglass/ui/desktop/panel-detail";
import { DesktopPanelSection } from "@guerillaglass/ui/desktop/panel-section";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@guerillaglass/ui/components/empty";
import { useStudio } from "../state/StudioProvider";

function projectNameFromPath(projectPath: string | null): string {
  if (!projectPath) {
    return "-";
  }
  const leaf = projectPath.split(/[\\/]/).filter(Boolean).pop();
  if (!leaf) {
    return "-";
  }
  return leaf.replace(/\.gglassproj$/i, "") || leaf;
}

export function ProjectUtilityPanel() {
  const studio = useStudio();
  const project = studio.projectQuery.data;
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [project?.projectPath, studio.recordingURL]);
  const captureMetadata = project?.projectPath
    ? project.captureMetadata
    : (studio.captureStatusQuery.data?.captureMetadata ?? project?.captureMetadata);
  const sourceName = formatCaptureTargetLabelFromMetadata({
    metadata: captureMetadata,
    displayLabel: studio.ui.labels.display,
    windowLabel: studio.ui.labels.window,
    untitledLabel: studio.ui.values.untitled,
    formatInteger: studio.formatInteger,
  });
  const recentProjects = studio.projectRecentsQuery.data?.items ?? [];
  const mediaBinItems = [
    {
      id: "source-video",
      label: studio.ui.labels.timelineLaneVideo,
      value: studio.recordingURL ?? "-",
      available: Boolean(studio.recordingURL),
    },
    {
      id: "source-events",
      label: studio.ui.labels.timelineLaneEvents,
      value: project?.projectPath
        ? (project.eventsURL ?? "-")
        : (studio.captureStatusQuery.data?.eventsURL ?? project?.eventsURL ?? "-"),
      available: Boolean(
        project?.projectPath
          ? project.eventsURL
          : (studio.captureStatusQuery.data?.eventsURL ?? project?.eventsURL),
      ),
    },
  ];

  return (
    <>
      <div className="gg-pane-header">
        <h2 className="gg-pane-title">{studio.ui.labels.activeProject}</h2>
        <p className="gg-pane-subtitle">{studio.ui.labels.projectUtilitySubtitle}</p>
      </div>

      <div ref={bodyRef} className="gg-pane-body gg-copy-compact gg-inspector-pane-body">
        <div className="space-y-3 pb-4">
          <DesktopPanelDetailRows
            rows={[
              {
                label: studio.ui.labels.projectName,
                value: project?.projectPath
                  ? projectNameFromPath(project.projectPath)
                  : studio.ui.values.untitled,
              },
              {
                label: studio.ui.labels.duration,
                value: studio.formatDuration(
                  studio.timelineItems.slice(-1)[0]?.programEndSeconds ?? 0,
                ),
              },
              {
                label: studio.ui.labels.captureSourceMetadata,
                value:
                  sourceName ??
                  (studio.recordingURL
                    ? m.ui_workflow_imported_source(undefined, { locale: studio.locale })
                    : "-"),
              },
              {
                label: studio.ui.labels.captureResolution,
                value: studio.recordingMediaSize
                  ? `${studio.formatInteger(studio.recordingMediaSize.width)}×${studio.formatInteger(studio.recordingMediaSize.height)}`
                  : captureMetadata
                    ? `${studio.formatInteger(captureMetadata.contentRect.width)}x${studio.formatInteger(captureMetadata.contentRect.height)}`
                    : "-",
              },
            ]}
          />
        </div>
        <DesktopPanelSection title={studio.ui.inspectorTabs.advanced}>
          <DesktopPanelDetailRows
            rows={[
              {
                label: studio.ui.labels.projectPath,
                value: project?.projectPath ?? studio.ui.labels.notSaved,
                valueClassName: "truncate",
              },
              {
                label: studio.ui.labels.recordingURL,
                value: studio.recordingURL ?? "-",
                valueClassName: "truncate",
              },
              {
                label: studio.ui.labels.eventsURL,
                value: project?.projectPath
                  ? (project.eventsURL ?? "-")
                  : (studio.captureStatusQuery.data?.eventsURL ?? project?.eventsURL ?? "-"),
                valueClassName: "truncate",
              },
              {
                label: studio.ui.labels.captureScale,
                value: captureMetadata ? studio.formatDecimal(captureMetadata.pixelScale) : "-",
              },
            ]}
          />
        </DesktopPanelSection>

        <DesktopPanelSection title={studio.ui.labels.mediaBin}>
          <div className="space-y-1.5">
            {mediaBinItems.map((item) => (
              <DesktopPanelCard key={item.id} className="space-y-0.5 px-2 py-1.5">
                <div className="gg-copy-strong">{item.label}</div>
                <div className="gg-copy-meta truncate">
                  {item.value.split(/[\\/]/).filter(Boolean).pop() ?? "-"}
                </div>
                <div className="gg-copy-meta">
                  {item.available
                    ? m.ui_workflow_source_attached(undefined, { locale: studio.locale })
                    : studio.ui.labels.mediaMissing}
                </div>
              </DesktopPanelCard>
            ))}
          </div>
        </DesktopPanelSection>

        <DesktopPanelSection
          title={
            <span className="inline-flex items-center gap-1">
              <FolderClock className="h-3.5 w-3.5" /> {studio.ui.labels.recentProjects}
            </span>
          }
        >
          {studio.projectRecentsQuery.isPending ? (
            <Empty className="min-h-0 border-border/50 bg-background/30 p-3">
              <EmptyHeader>
                <EmptyTitle className="text-sm">{studio.ui.labels.recentProjects}</EmptyTitle>
                <EmptyDescription>{studio.ui.labels.loadingRecentProjects}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {!studio.projectRecentsQuery.isPending && recentProjects.length === 0 ? (
            <Empty className="min-h-0 border-border/50 bg-background/30 p-3">
              <EmptyHeader>
                <EmptyTitle className="text-sm">{studio.ui.labels.recentProjects}</EmptyTitle>
                <EmptyDescription>{studio.ui.labels.noRecentProjects}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <div className="space-y-1.5">
            {recentProjects.map((item) => (
              <DesktopPanelCard key={item.projectPath} className="space-y-0.5 px-2 py-1.5">
                <div className="gg-copy-strong truncate">{item.displayName}</div>
                <div className="gg-copy-meta truncate">{item.projectPath}</div>
                <div className="gg-copy-meta">{`${studio.ui.labels.lastOpened}: ${studio.formatDateTime(item.lastOpenedAt)}`}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gg-left-rail-action mt-1"
                  onClick={() =>
                    void studio.openRecentProjectMutation.mutateAsync(item.projectPath)
                  }
                  disabled={studio.isRunningAction}
                >
                  <FolderOpen className="mr-2 h-4 w-4" /> {studio.ui.actions.openRecent}
                </Button>
              </DesktopPanelCard>
            ))}
          </div>
        </DesktopPanelSection>
      </div>
    </>
  );
}
