import { FolderClock, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useStudio } from "../studio/context";

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

      <div className="gg-pane-body gg-copy-compact space-y-3">
        <Card size="sm" className="gg-surface-block">
          <CardContent className="gg-numeric space-y-1">
            <div>{`${studio.ui.labels.projectName}: ${projectNameFromPath(project?.projectPath ?? null)}`}</div>
            <div className="truncate">{`${studio.ui.labels.projectPath}: ${project?.projectPath ?? studio.ui.labels.notSaved}`}</div>
            <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
            <div className="truncate">{`${studio.ui.labels.eventsURL}: ${project?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-"}`}</div>
            <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
            <div>{`${studio.ui.labels.captureSourceMetadata}: ${captureMetadata?.source ?? "-"}`}</div>
            <div>
              {`${studio.ui.labels.captureResolution}: ${
                captureMetadata
                  ? `${studio.formatInteger(captureMetadata.contentRect.width)}x${studio.formatInteger(captureMetadata.contentRect.height)}`
                  : "-"
              }`}
            </div>
            <div>
              {`${studio.ui.labels.captureScale}: ${
                captureMetadata ? studio.formatDecimal(captureMetadata.pixelScale) : "-"
              }`}
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="gg-surface-block">
          <CardHeader>
            <CardTitle className="gg-utility-label">{studio.ui.labels.mediaBin}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mediaBinItems.map((item) => (
              <Card
                key={item.id}
                size="sm"
                className="border border-border/50 bg-background/35 shadow-none"
              >
                <CardContent className="space-y-1">
                  <div className="gg-copy-strong">{item.label}</div>
                  <div className="gg-copy-meta truncate">{item.value}</div>
                  <div className="gg-copy-meta">
                    {item.available ? studio.ui.labels.mediaReady : studio.ui.labels.mediaMissing}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <ButtonGroup className="flex-wrap gap-2">
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

        <Card size="sm" className="gg-surface-block">
          <CardHeader>
            <CardTitle className="gg-utility-label">
              <span className="inline-flex items-center gap-1">
                <FolderClock className="h-3.5 w-3.5" /> {studio.ui.labels.recentProjects}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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

            {recentProjects.map((item) => (
              <Card
                key={item.projectPath}
                size="sm"
                className="border border-border/50 bg-background/35 shadow-none"
              >
                <CardContent className="space-y-1">
                  <div className="gg-copy-strong truncate">{item.displayName}</div>
                  <div className="gg-copy-meta truncate">{item.projectPath}</div>
                  <div className="gg-copy-meta">{`${studio.ui.labels.lastOpened}: ${studio.formatDateTime(item.lastOpenedAt)}`}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() =>
                      void studio.openRecentProjectMutation.mutateAsync(item.projectPath)
                    }
                    disabled={studio.isRunningAction}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" /> {studio.ui.actions.openRecent}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
