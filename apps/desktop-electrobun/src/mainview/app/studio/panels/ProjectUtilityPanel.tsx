import { ChevronRight, FolderClock, FolderOpen, Save } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
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
  const captureMetadata = project?.captureMetadata;
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
      value: project?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-",
      available: Boolean(project?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL),
    },
  ];

  return (
    <>
      <div className="gg-pane-header">
        <h2 className="gg-pane-title">{studio.ui.labels.activeProject}</h2>
        <p className="gg-pane-subtitle">{studio.ui.labels.projectUtilitySubtitle}</p>
      </div>

      <div className="gg-pane-body gg-copy-compact gg-inspector-pane-body">
        <ProjectPanelSection title={studio.ui.labels.activeProject}>
          <div className="gg-inspector-detail-list gg-numeric">
            <div className="gg-inspector-detail-row">{`${studio.ui.labels.projectName}: ${projectNameFromPath(project?.projectPath ?? null)}`}</div>
            <div className="gg-inspector-detail-row truncate">{`${studio.ui.labels.projectPath}: ${project?.projectPath ?? studio.ui.labels.notSaved}`}</div>
            <div className="gg-inspector-detail-row truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
            <div className="gg-inspector-detail-row truncate">{`${studio.ui.labels.eventsURL}: ${project?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-"}`}</div>
            <div className="gg-inspector-detail-row">{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
            <div className="gg-inspector-detail-row">{`${studio.ui.labels.captureSourceMetadata}: ${captureMetadata?.source ?? "-"}`}</div>
            <div className="gg-inspector-detail-row">
              {`${studio.ui.labels.captureResolution}: ${
                captureMetadata
                  ? `${studio.formatInteger(captureMetadata.contentRect.width)}x${studio.formatInteger(captureMetadata.contentRect.height)}`
                  : "-"
              }`}
            </div>
            <div className="gg-inspector-detail-row">
              {`${studio.ui.labels.captureScale}: ${
                captureMetadata ? studio.formatDecimal(captureMetadata.pixelScale) : "-"
              }`}
            </div>
          </div>

          <ButtonGroup className="flex-wrap gap-1.5 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void studio.openProjectMutation.mutateAsync()}
              disabled={studio.isRunningAction}
            >
              <FolderOpen className="mr-2 h-4 w-4" /> {studio.ui.actions.openProject}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
              disabled={studio.isRunningAction || !studio.recordingURL}
            >
              <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProject}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
              disabled={studio.isRunningAction || !studio.recordingURL}
            >
              <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProjectAs}
            </Button>
          </ButtonGroup>
        </ProjectPanelSection>

        <ProjectPanelSection title={studio.ui.labels.mediaBin}>
          <div className="space-y-1.5">
            {mediaBinItems.map((item) => (
              <div
                key={item.id}
                className="space-y-0.5 rounded-sm border border-border/65 bg-background/25 px-2 py-1.5"
              >
                <div className="gg-copy-strong">{item.label}</div>
                <div className="gg-copy-meta truncate">{item.value}</div>
                <div className="gg-copy-meta">
                  {item.available ? studio.ui.labels.mediaReady : studio.ui.labels.mediaMissing}
                </div>
              </div>
            ))}
          </div>
        </ProjectPanelSection>

        <ProjectPanelSection
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
              <div
                key={item.projectPath}
                className="space-y-0.5 rounded-sm border border-border/65 bg-background/25 px-2 py-1.5"
              >
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
              </div>
            ))}
          </div>
        </ProjectPanelSection>
      </div>
    </>
  );
}

function ProjectPanelSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={false} className={cn("gg-inspector-section", className)}>
      <CollapsibleTrigger className="gg-inspector-section-trigger">
        <ChevronRight className="gg-inspector-section-chevron" />
        <h3 className="gg-inspector-section-header border-0 pb-0">{title}</h3>
      </CollapsibleTrigger>
      <CollapsibleContent className="gg-inspector-section-content">
        <div className="gg-inspector-section-body">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
