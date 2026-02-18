import { Mic, MonitorCog, MousePointer, ScreenShare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineApi } from "@/lib/engine";
import { useStudio } from "../studio/context";

export function CaptureRoute() {
  const studio = useStudio();
  const settingsValues = studio.settingsForm.state.values;

  return (
    <section className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
      <aside className="space-y-3">
        <Card className="gg-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> {studio.ui.sections.leftRail}
            </CardTitle>
            <CardDescription>{studio.ui.labels.inputMonitoring}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <div>{`Screen: ${studio.permissionsQuery.data?.screenRecordingGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
              <div>{`Mic: ${studio.permissionsQuery.data?.microphoneGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
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

            <div className="space-y-2 border-t border-border/70 pt-3 text-sm">
              <div className="font-medium">{studio.ui.labels.captureSource}</div>
              <studio.settingsForm.Field name="captureSource">
                {(field) => (
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.state.value === "display"}
                        onChange={() => field.handleChange("display")}
                      />
                      {studio.ui.labels.display}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.state.value === "window"}
                        onChange={() => field.handleChange("window")}
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
                      value={field.state.value}
                      onChange={(event) => field.handleChange(Number(event.target.value))}
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
          </CardContent>
        </Card>
      </aside>

      <section>
        <Card className="gg-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScreenShare className="h-4 w-4" /> {studio.ui.sections.center}
            </CardTitle>
            <CardDescription>
              {studio.captureStatusQuery.data?.isRunning
                ? studio.ui.helper.activePreviewBody
                : studio.ui.helper.emptyPreviewBody}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {studio.inputMonitoringDenied && settingsValues.trackInputEvents ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">{studio.ui.helper.degradedModeTitle}</p>
                <p className="mt-1 text-destructive/90">{studio.ui.helper.degradedModeBody}</p>
              </div>
            ) : null}

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
          </CardContent>
        </Card>
      </section>

      <aside>
        <Card className="gg-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorCog className="h-4 w-4" /> Capture Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <studio.settingsForm.Field name="micEnabled">
              {(field) => (
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                  <Mic className="h-4 w-4" /> {studio.ui.labels.includeMic}
                </label>
              )}
            </studio.settingsForm.Field>

            <studio.settingsForm.Field name="trackInputEvents">
              {(field) => (
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                  <MousePointer className="h-4 w-4" /> {studio.ui.labels.trackInput}
                </label>
              )}
            </studio.settingsForm.Field>

            <studio.settingsForm.Field name="autoZoom">
              {(field) => (
                <div className="space-y-3 rounded-md border border-border/70 bg-background/70 p-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.state.value.isEnabled}
                      onChange={(event) =>
                        field.handleChange({
                          ...field.state.value,
                          isEnabled: event.target.checked,
                        })
                      }
                    />
                    {studio.ui.labels.autoZoomEnabled}
                  </label>
                  <label className="grid gap-1">
                    {studio.ui.labels.autoZoomIntensity(
                      Math.round(field.state.value.intensity * 100),
                    )}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={field.state.value.intensity}
                      onChange={(event) =>
                        field.handleChange({
                          ...field.state.value,
                          intensity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    {studio.ui.labels.minimumKeyframeInterval}
                    <input
                      className="gg-input"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={field.state.value.minimumKeyframeInterval}
                      onChange={(event) =>
                        field.handleChange({
                          ...field.state.value,
                          minimumKeyframeInterval: Math.max(
                            0.01,
                            Number(event.target.value) || 0.01,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </studio.settingsForm.Field>
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}
