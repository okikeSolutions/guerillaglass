import { FolderClock, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function formatLastOpened(dateTime: string): string {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.valueOf())) {
    return dateTime;
  }
  return parsed.toLocaleString();
}

export function ProjectUtilityPanel() {
  const studio = useStudio();
  const project = studio.projectQuery.data;
  const captureMetadata = project?.captureMetadata;
  const recentProjects = studio.projectRecentsQuery.data?.items ?? [];

  return (
    <>
      <div className="gg-pane-header">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          {studio.ui.labels.activeProject}
        </h2>
        <p className="gg-pane-subtitle">{studio.ui.labels.projectUtilitySubtitle}</p>
      </div>

      <div className="gg-pane-body space-y-3 text-sm">
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <div>{`${studio.ui.labels.projectName}: ${projectNameFromPath(project?.projectPath ?? null)}`}</div>
          <div className="truncate">{`${studio.ui.labels.projectPath}: ${project?.projectPath ?? studio.ui.labels.notSaved}`}</div>
          <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
          <div className="truncate">{`${studio.ui.labels.eventsURL}: ${project?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-"}`}</div>
          <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
          <div>{`${studio.ui.labels.captureSourceMetadata}: ${captureMetadata?.source ?? "-"}`}</div>
          <div>
            {`${studio.ui.labels.captureResolution}: ${captureMetadata ? `${captureMetadata.contentRect.width.toFixed(0)}x${captureMetadata.contentRect.height.toFixed(0)}` : "-"}`}
          </div>
          <div>
            {`${studio.ui.labels.captureScale}: ${captureMetadata ? captureMetadata.pixelScale.toFixed(2) : "-"}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <span className="inline-flex items-center gap-1">
              <FolderClock className="h-3.5 w-3.5" /> {studio.ui.labels.recentProjects}
            </span>
          </p>

          {studio.projectRecentsQuery.isPending ? (
            <div className="text-xs text-muted-foreground">
              {studio.ui.labels.loadingRecentProjects}
            </div>
          ) : null}

          {!studio.projectRecentsQuery.isPending && recentProjects.length === 0 ? (
            <div className="text-xs text-muted-foreground">{studio.ui.labels.noRecentProjects}</div>
          ) : null}

          <div className="space-y-2">
            {recentProjects.map((item) => (
              <div
                key={item.projectPath}
                className="rounded border border-border/60 bg-background/60 p-2"
              >
                <div className="truncate text-sm font-medium">{item.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{item.projectPath}</div>
                <div className="mt-1 text-xs text-muted-foreground">{`${studio.ui.labels.lastOpened}: ${formatLastOpened(item.lastOpenedAt)}`}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
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
        </div>
      </div>
    </>
  );
}
