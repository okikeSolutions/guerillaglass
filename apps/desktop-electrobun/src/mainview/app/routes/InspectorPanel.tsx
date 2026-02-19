import { Keyboard, Mic, MonitorCog, MousePointer, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useStudio } from "../studio/context";
import {
  resolveInspectorView,
  type InspectorSelection,
  type StudioMode,
} from "../studio/inspectorContext";

type InspectorPanelProps = {
  mode: StudioMode;
};

function SelectionDetails({ selection }: { selection: InspectorSelection }) {
  const studio = useStudio();

  if (selection.kind === "none") {
    return null;
  }

  switch (selection.kind) {
    case "timelineClip":
      return (
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {studio.ui.inspector.cards.selectedClip}
          </p>
          <div>{`${studio.ui.inspector.fields.lane}: ${selection.laneId}`}</div>
          <div>{`${studio.ui.inspector.fields.start}: ${studio.formatDecimal(selection.startSeconds)}s`}</div>
          <div>{`${studio.ui.inspector.fields.end}: ${studio.formatDecimal(selection.endSeconds)}s`}</div>
          <div>
            {`${studio.ui.inspector.fields.duration}: ${studio.formatDecimal(
              Math.max(0, selection.endSeconds - selection.startSeconds),
            )}s`}
          </div>
        </div>
      );
    case "timelineMarker":
      return (
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {studio.ui.inspector.cards.selectedEventMarker}
          </p>
          <div>{`${studio.ui.inspector.fields.type}: ${selection.markerKind}`}</div>
          <div>{`${studio.ui.inspector.fields.time}: ${studio.formatDecimal(selection.timestampSeconds)}s`}</div>
          <div>{`${studio.ui.inspector.fields.density}: ${selection.density}`}</div>
        </div>
      );
    case "captureWindow":
      return (
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {studio.ui.inspector.cards.selectedWindow}
          </p>
          <div>{`${studio.ui.inspector.fields.app}: ${selection.appName}`}</div>
          <div className="truncate">{`${studio.ui.inspector.fields.title}: ${selection.title || studio.ui.values.untitled}`}</div>
          <div>{`${studio.ui.inspector.fields.windowId}: ${selection.windowId}`}</div>
        </div>
      );
    case "exportPreset":
      return (
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {studio.ui.inspector.cards.selectedPreset}
          </p>
          <div>{selection.name}</div>
          <div className="text-muted-foreground">{`${selection.width}:${selection.height}`}</div>
          <div>{`${studio.ui.inspector.fields.fileType}: ${selection.fileType}`}</div>
        </div>
      );
    default: {
      const _exhaustiveCheck: never = selection;
      void _exhaustiveCheck;
      return null;
    }
  }
}

function CaptureInspectorContent() {
  const studio = useStudio();

  return (
    <>
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

      <studio.settingsForm.Field name="singleKeyShortcutsEnabled">
        {(field) => (
          <div className="space-y-1">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
              />
              <Keyboard className="h-4 w-4" /> {studio.ui.labels.singleKeyShortcuts}
            </label>
            <p className="text-xs text-muted-foreground">{studio.ui.helper.singleKeyShortcuts}</p>
          </div>
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
              {studio.ui.labels.autoZoomIntensity(Math.round(field.state.value.intensity * 100))}
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
                    minimumKeyframeInterval: Math.max(0.01, Number(event.target.value) || 0.01),
                  })
                }
              />
            </label>
          </div>
        )}
      </studio.settingsForm.Field>
    </>
  );
}

function EditInspectorContent({ selection }: { selection: InspectorSelection }) {
  const studio = useStudio();

  return (
    <>
      {selection.kind === "timelineClip" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setTrimStartSeconds(selection.startSeconds)}
          >
            {studio.ui.inspector.actions.setTrimInToClipStart}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setTrimEndSeconds(selection.endSeconds)}
          >
            {studio.ui.inspector.actions.setTrimOutToClipEnd}
          </Button>
        </div>
      ) : null}

      {selection.kind === "timelineMarker" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setPlayheadSeconds(selection.timestampSeconds)}
          >
            {studio.ui.inspector.actions.jumpPlayheadToMarker}
          </Button>
        </div>
      ) : null}

      <studio.settingsForm.Field name="autoZoom">
        {(field) => (
          <div className="rounded-md border border-border/70 bg-background/70 p-3">
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> {studio.ui.inspectorTabs.effects}
              </span>
            </p>
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
            <label className="mt-2 grid gap-1">
              {studio.ui.labels.autoZoomIntensity(Math.round(field.state.value.intensity * 100))}
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
          </div>
        )}
      </studio.settingsForm.Field>
    </>
  );
}

function DeliverInspectorContent() {
  const studio = useStudio();

  return (
    <>
      <div className="rounded-md border border-border/70 bg-background/70 p-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {studio.ui.inspector.cards.activePreset}
        </p>
        <div>{studio.selectedPreset?.name ?? "-"}</div>
        {studio.selectedPreset ? (
          <div className="text-muted-foreground">
            {studio.formatAspectRatio(studio.selectedPreset.width, studio.selectedPreset.height)}
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-border/70 bg-background/70 p-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {studio.ui.inspector.cards.trimWindow}
        </p>
        <div>{`${studio.ui.labels.trimInSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimStartSeconds)}`}</div>
        <div>{`${studio.ui.labels.trimOutSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimEndSeconds)}`}</div>
      </div>
    </>
  );
}

export function InspectorPanel({ mode }: InspectorPanelProps) {
  const studio = useStudio();
  const selection = studio.inspectorSelection;
  const view = useMemo(() => resolveInspectorView(mode, selection), [mode, selection]);
  const viewText = studio.ui.inspector.views[view.id];

  return (
    <aside className="gg-pane gg-pane-right">
      <div className="gg-pane-header">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          <MonitorCog className="h-4 w-4" /> {viewText.title}
        </h2>
        <p className="gg-pane-subtitle">{viewText.subtitle}</p>
      </div>
      <div className="gg-pane-body space-y-3 text-sm">
        <SelectionDetails selection={selection} />

        {mode === "capture" ? <CaptureInspectorContent /> : null}
        {mode === "edit" ? <EditInspectorContent selection={selection} /> : null}
        {mode === "deliver" ? <DeliverInspectorContent /> : null}
      </div>
    </aside>
  );
}
