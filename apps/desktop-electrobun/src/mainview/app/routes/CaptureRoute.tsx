import { ScreenShare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { engineApi } from "@/lib/engine";
import { useStudio } from "../studio/context";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";

export function CaptureRoute() {
  const studio = useStudio();
  const settingsValues = studio.settingsForm.state.values;

  return (
    <EditorWorkspace
      leftPane={
        <aside className="gg-pane gg-pane-left">
          <div className="gg-pane-header">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
              <ShieldCheck className="h-4 w-4" /> {studio.ui.sections.leftRail}
            </h2>
            <p className="gg-pane-subtitle">{studio.ui.labels.inputMonitoring}</p>
          </div>
          <div className="gg-pane-body space-y-4 text-sm">
            <div className="space-y-1">
              <div>{`${studio.ui.labels.screen}: ${studio.permissionsQuery.data?.screenRecordingGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
              <div>{`${studio.ui.labels.microphone}: ${studio.permissionsQuery.data?.microphoneGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
              <div>{`${studio.ui.labels.inputMonitoring}: ${studio.permissionsQuery.data?.inputMonitoring ?? studio.ui.values.unknown}`}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void studio.requestPermissionMutation.mutateAsync("screen")}
              >
                {studio.ui.actions.requestScreen}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void studio.requestPermissionMutation.mutateAsync("mic")}
              >
                {studio.ui.actions.requestMic}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void studio.requestPermissionMutation.mutateAsync("input")}
              >
                {studio.ui.actions.requestInput}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void engineApi.openInputMonitoringSettings()}
              >
                {studio.ui.actions.openSettings}
              </Button>
            </div>

            <div className="space-y-2 border-t border-border/70 pt-3">
              <div className="font-medium">{studio.ui.labels.captureSource}</div>
              <studio.settingsForm.Field name="captureSource">
                {(field) => (
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.state.value === "display"}
                        onChange={() => {
                          field.handleChange("display");
                          if (studio.inspectorSelection.kind === "captureWindow") {
                            studio.clearInspectorSelection();
                          }
                        }}
                      />
                      {studio.ui.labels.display}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.state.value === "window"}
                        onChange={() => {
                          field.handleChange("window");
                          const selectedWindow = studio.windowChoices.find(
                            (windowItem) => windowItem.id === studio.selectedWindowId,
                          );
                          if (!selectedWindow) {
                            return;
                          }
                          studio.selectCaptureWindow({
                            windowId: selectedWindow.id,
                            appName: selectedWindow.appName,
                            title: selectedWindow.title,
                          });
                        }}
                      />
                      {studio.ui.labels.window}
                    </label>
                  </div>
                )}
              </studio.settingsForm.Field>

              {settingsValues.captureSource === "window" ? (
                <studio.settingsForm.Field name="selectedWindowId">
                  {(field) => (
                    <select
                      className="gg-input"
                      value={studio.selectedWindowId}
                      onChange={(event) => {
                        const windowId = Number(event.target.value);
                        field.handleChange(windowId);
                        const selectedWindow = studio.windowChoices.find(
                          (windowItem) => windowItem.id === windowId,
                        );
                        if (!selectedWindow) {
                          studio.clearInspectorSelection();
                          return;
                        }
                        studio.selectCaptureWindow({
                          windowId: selectedWindow.id,
                          appName: selectedWindow.appName,
                          title: selectedWindow.title,
                        });
                      }}
                    >
                      {studio.windowChoices.length === 0 ? (
                        <option value={0}>{studio.ui.labels.noWindows}</option>
                      ) : null}
                      {studio.windowChoices.map((windowItem) => (
                        <option key={windowItem.id} value={windowItem.id}>
                          {windowItem.appName} - {windowItem.title || studio.ui.values.untitled}
                        </option>
                      ))}
                    </select>
                  )}
                </studio.settingsForm.Field>
              ) : null}
            </div>
          </div>
        </aside>
      }
      centerPane={
        <section className="gg-pane gg-pane-center">
          <div className="gg-pane-header">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
              <ScreenShare className="h-4 w-4" /> {studio.ui.sections.center}
            </h2>
            <p className="gg-pane-subtitle">
              {studio.captureStatusQuery.data?.isRunning
                ? studio.ui.helper.activePreviewBody
                : studio.ui.helper.emptyPreviewBody}
            </p>
          </div>
          <div className="gg-pane-body space-y-3">
            {studio.inputMonitoringDenied && settingsValues.trackInputEvents ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">{studio.ui.helper.degradedModeTitle}</p>
                <p className="mt-1 text-destructive/90">{studio.ui.helper.degradedModeBody}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void studio.startPreviewMutation.mutateAsync()}
                disabled={studio.isRunningAction || studio.captureStatusQuery.data?.isRunning}
              >
                {studio.ui.actions.startPreview}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void studio.stopPreviewMutation.mutateAsync()}
                disabled={studio.isRunningAction || !studio.captureStatusQuery.data?.isRunning}
              >
                {studio.ui.actions.stopPreview}
              </Button>
            </div>

            <div className="gg-preview-stage">
              {studio.captureStatusQuery.data?.isRunning ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{studio.ui.helper.activePreviewTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {studio.ui.helper.activePreviewBody}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{studio.ui.helper.emptyPreviewTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {studio.ui.helper.emptyPreviewBody}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div>{`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}</div>
              <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
              <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
            </div>
          </div>
        </section>
      }
      rightPane={<InspectorPanel mode="capture" />}
    />
  );
}
