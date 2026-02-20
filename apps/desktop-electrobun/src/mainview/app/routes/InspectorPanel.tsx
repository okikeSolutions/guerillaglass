import { Keyboard, Mic, MonitorCog, MousePointer, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "../studio/context";
import {
  resolveInspectorView,
  type InspectorSelection,
  type StudioMode,
} from "../studio/inspectorContext";

type InspectorPanelProps = {
  mode: StudioMode;
};

function localizeTimelineLaneId(
  laneId: "video" | "audio",
  studio: ReturnType<typeof useStudio>,
): string {
  if (laneId === "audio") {
    return studio.ui.labels.timelineLaneAudio;
  }
  return studio.ui.labels.timelineLaneVideo;
}

function localizeTimelineMarkerKind(
  markerKind: "move" | "click" | "mixed",
  studio: ReturnType<typeof useStudio>,
): string {
  if (markerKind === "click") {
    return studio.ui.labels.timelineMarkerClick;
  }
  if (markerKind === "mixed") {
    return studio.ui.labels.timelineMarkerMixed;
  }
  return studio.ui.labels.timelineMarkerMove;
}

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
          <div>{`${studio.ui.inspector.fields.lane}: ${localizeTimelineLaneId(selection.laneId, studio)}`}</div>
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
          <div>{`${studio.ui.inspector.fields.type}: ${localizeTimelineMarkerKind(selection.markerKind, studio)}`}</div>
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
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const rawMeter =
    telemetry?.audioLevelDbfs == null ? 0 : clampDbfsToMeter(telemetry.audioLevelDbfs);
  const masterMeter = studio.audioMixer.masterMuted ? 0 : rawMeter * studio.audioMixer.masterGain;
  const micMeter = studio.audioMixer.micMuted ? 0 : rawMeter * studio.audioMixer.micGain;
  const captureSource = studio.settingsForm.state.values.captureSource;

  return (
    <>
      <studio.settingsForm.Field name="micEnabled">
        {(field) => (
          <Label>
            <Checkbox
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
            <Mic className="h-4 w-4" /> {studio.ui.labels.includeMic}
          </Label>
        )}
      </studio.settingsForm.Field>

      <studio.settingsForm.Field name="trackInputEvents">
        {(field) => (
          <Label>
            <Checkbox
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
            <MousePointer className="h-4 w-4" /> {studio.ui.labels.trackInput}
          </Label>
        )}
      </studio.settingsForm.Field>

      <studio.settingsForm.Field name="singleKeyShortcutsEnabled">
        {(field) => (
          <div className="space-y-1">
            <Label>
              <Checkbox
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
              />
              <Keyboard className="h-4 w-4" /> {studio.ui.labels.singleKeyShortcuts}
            </Label>
            <p className="text-xs text-muted-foreground">{studio.ui.helper.singleKeyShortcuts}</p>
          </div>
        )}
      </studio.settingsForm.Field>

      <studio.settingsForm.Field name="autoZoom">
        {(field) => (
          <div className="space-y-3 rounded-md border border-border/70 bg-background/70 p-3">
            <Label>
              <Checkbox
                checked={field.state.value.isEnabled}
                onCheckedChange={(checked) =>
                  field.handleChange({
                    ...field.state.value,
                    isEnabled: checked,
                  })
                }
              />
              {studio.ui.labels.autoZoomEnabled}
            </Label>
            <Label className="grid gap-1">
              {studio.ui.labels.autoZoomIntensity(Math.round(field.state.value.intensity * 100))}
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[field.state.value.intensity]}
                onValueChange={(nextValue) =>
                  field.handleChange({
                    ...field.state.value,
                    intensity: readSliderValue(nextValue),
                  })
                }
              />
            </Label>
            <Label className="grid gap-1">
              {studio.ui.labels.minimumKeyframeInterval}
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={Number(field.state.value.minimumKeyframeInterval.toFixed(2))}
                onChange={(event) =>
                  field.handleChange({
                    ...field.state.value,
                    minimumKeyframeInterval: Math.max(0.01, Number(event.target.value) || 0.01),
                  })
                }
              />
            </Label>
          </div>
        )}
      </studio.settingsForm.Field>

      <div className="rounded-md border border-border/70 bg-background/70 p-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {studio.ui.labels.sourceMonitor}
        </p>
        <div className="space-y-1 text-xs">
          <div>{`${studio.ui.labels.display}: ${captureSource === "display" ? studio.ui.values.on : studio.ui.values.off}`}</div>
          <div>{`${studio.ui.labels.window}: ${captureSource === "window" ? studio.ui.values.on : studio.ui.values.off}`}</div>
          <div>{`${studio.ui.labels.microphone}: ${studio.settingsForm.state.values.micEnabled ? studio.ui.values.on : studio.ui.values.off}`}</div>
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-background/70 p-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {studio.ui.labels.audioMixer}
        </p>
        <div className="space-y-3">
          <AudioMixerChannel
            label={studio.ui.labels.masterChannel}
            value={studio.audioMixer.masterGain}
            level={masterMeter}
            muted={studio.audioMixer.masterMuted}
            muteLabel={studio.ui.labels.mute}
            unmuteLabel={studio.ui.labels.unmute}
            onValueChange={(value) => studio.setAudioMixerGain("master", value)}
            onToggleMuted={() => studio.toggleAudioMixerMuted("master")}
          />
          <AudioMixerChannel
            label={studio.ui.labels.microphone}
            value={studio.audioMixer.micGain}
            level={micMeter}
            muted={studio.audioMixer.micMuted}
            muteLabel={studio.ui.labels.mute}
            unmuteLabel={studio.ui.labels.unmute}
            onValueChange={(value) => studio.setAudioMixerGain("mic", value)}
            onToggleMuted={() => studio.toggleAudioMixerMuted("mic")}
          />
        </div>
      </div>
    </>
  );
}

function clampDbfsToMeter(audioLevelDbfs: number): number {
  if (!Number.isFinite(audioLevelDbfs)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (audioLevelDbfs + 60) / 60));
}

function readSliderValue(value: number | readonly number[]): number {
  if (typeof value === "number") {
    return value;
  }
  return value[0] ?? 0;
}

function AudioMixerChannel({
  label,
  level,
  muted,
  onToggleMuted,
  onValueChange,
  value,
  muteLabel,
  unmuteLabel,
}: {
  label: string;
  level: number;
  muted: boolean;
  value: number;
  muteLabel: string;
  unmuteLabel: string;
  onValueChange: (value: number) => void;
  onToggleMuted: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          aria-label={muted ? unmuteLabel : muteLabel}
          title={muted ? unmuteLabel : muteLabel}
          onClick={onToggleMuted}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <Progress value={Math.round(level * 100)} />
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(nextValue) => onValueChange(readSliderValue(nextValue))}
      />
    </div>
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
            <Label>
              <Checkbox
                checked={field.state.value.isEnabled}
                onCheckedChange={(checked) =>
                  field.handleChange({
                    ...field.state.value,
                    isEnabled: checked,
                  })
                }
              />
              {studio.ui.labels.autoZoomEnabled}
            </Label>
            <Label className="mt-2 grid gap-1">
              {studio.ui.labels.autoZoomIntensity(Math.round(field.state.value.intensity * 100))}
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[field.state.value.intensity]}
                onValueChange={(nextValue) =>
                  field.handleChange({
                    ...field.state.value,
                    intensity: readSliderValue(nextValue),
                  })
                }
              />
            </Label>
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
