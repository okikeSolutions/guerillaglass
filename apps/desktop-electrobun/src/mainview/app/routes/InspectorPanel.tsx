import {
  ChevronRight,
  Keyboard,
  Mic,
  MonitorCog,
  MousePointer,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { captureFrameRates, type CaptureFrameRate } from "@guerillaglass/engine-protocol";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useStudio } from "../studio/context";
import { buildCaptureTelemetryPresentation } from "../studio/captureTelemetryPresentation";
import {
  resolveInspectorView,
  type InspectorSelection,
  type StudioMode,
} from "../studio/inspectorContext";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "./StudioPane";

type InspectorPanelProps = {
  mode: StudioMode;
};

function InspectorSection({
  title,
  children,
  className,
}: {
  title: string;
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

function InspectorDetailList({ children }: { children: ReactNode }) {
  return <div className="gg-inspector-detail-list gg-numeric">{children}</div>;
}

function InspectorDetailRow({ value, className }: { value: string; className?: string }) {
  return <div className={cn("gg-inspector-detail-row", className)}>{value}</div>;
}

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
        <InspectorSection title={studio.ui.inspector.cards.selectedClip}>
          <InspectorDetailList>
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.lane}: ${localizeTimelineLaneId(selection.laneId, studio)}`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.start}: ${studio.formatDecimal(selection.startSeconds)}s`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.end}: ${studio.formatDecimal(selection.endSeconds)}s`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.duration}: ${studio.formatDecimal(
                Math.max(0, selection.endSeconds - selection.startSeconds),
              )}s`}
            />
          </InspectorDetailList>
        </InspectorSection>
      );
    case "timelineMarker":
      return (
        <InspectorSection title={studio.ui.inspector.cards.selectedEventMarker}>
          <InspectorDetailList>
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.type}: ${localizeTimelineMarkerKind(selection.markerKind, studio)}`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.time}: ${studio.formatDecimal(selection.timestampSeconds)}s`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.density}: ${selection.density}`}
            />
          </InspectorDetailList>
        </InspectorSection>
      );
    case "captureWindow":
      return (
        <InspectorSection title={studio.ui.inspector.cards.selectedWindow}>
          <InspectorDetailList>
            <InspectorDetailRow value={`${studio.ui.inspector.fields.app}: ${selection.appName}`} />
            <InspectorDetailRow
              className="truncate"
              value={`${studio.ui.inspector.fields.title}: ${selection.title || studio.ui.values.untitled}`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.windowId}: ${selection.windowId}`}
            />
          </InspectorDetailList>
        </InspectorSection>
      );
    case "exportPreset":
      return (
        <InspectorSection title={studio.ui.inspector.cards.selectedPreset}>
          <InspectorDetailList>
            <InspectorDetailRow value={selection.name} />
            <InspectorDetailRow
              className="text-muted-foreground"
              value={`${selection.width}:${selection.height}`}
            />
            <InspectorDetailRow
              value={`${studio.ui.inspector.fields.fileType}: ${selection.fileType}`}
            />
          </InspectorDetailList>
        </InspectorSection>
      );
    default: {
      const _exhaustiveCheck: never = selection;
      void _exhaustiveCheck;
      return null;
    }
  }
}

type AutoZoomSectionProps = {
  headingIcon?: ReactNode;
  showMinimumKeyframeInterval?: boolean;
  showAudioMixer?: boolean;
  sliderClassName?: string;
};

function AutoZoomSection({
  headingIcon,
  showMinimumKeyframeInterval = false,
  showAudioMixer = false,
  sliderClassName,
}: AutoZoomSectionProps) {
  const studio = useStudio();
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const rawMeter =
    telemetry?.audioLevelDbfs == null ? 0 : clampDbfsToMeter(telemetry.audioLevelDbfs);
  const masterMeter = studio.audioMixer.masterMuted ? 0 : rawMeter * studio.audioMixer.masterGain;
  const micMeter = studio.audioMixer.micMuted ? 0 : rawMeter * studio.audioMixer.micGain;

  return (
    <studio.settingsForm.Field name="autoZoom">
      {(field) => (
        <div className="space-y-2 px-0.5">
          <p className="gg-utility-label inline-flex items-center gap-1">
            {headingIcon}
            {studio.ui.labels.autoZoomSection}
          </p>
          <Field>
            <FieldLabel className="items-center">
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
            </FieldLabel>
          </Field>
          <Field>
            <FieldLabel>
              {studio.ui.labels.autoZoomIntensity(Math.round(field.state.value.intensity * 100))}
            </FieldLabel>
            <FieldContent>
              <Slider
                className={sliderClassName}
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
            </FieldContent>
          </Field>
          {showMinimumKeyframeInterval ? (
            <Field>
              <FieldLabel>{studio.ui.labels.minimumKeyframeInterval}</FieldLabel>
              <FieldContent>
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
              </FieldContent>
            </Field>
          ) : null}
          {showAudioMixer ? (
            <div className="space-y-2 pt-1">
              <p className="gg-utility-label">{studio.ui.labels.audioMixer}</p>
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
          ) : null}
        </div>
      )}
    </studio.settingsForm.Field>
  );
}

function CaptureInspectorContent() {
  const studio = useStudio();
  const captureSource = studio.settingsForm.state.values.captureSource;
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const telemetryPresentation = buildCaptureTelemetryPresentation(telemetry, {
    formatInteger: studio.formatInteger,
    formatDecimal: studio.formatDecimal,
  });
  const captureFpsOptions = captureFrameRates;

  return (
    <>
      <InspectorSection title={studio.ui.inspectorTabs.capture.toUpperCase()}>
        <studio.settingsForm.Field name="micEnabled">
          {(field) => (
            <Field>
              <FieldLabel className="gg-inspector-toggle-row">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <Mic className="h-4 w-4" /> {studio.ui.labels.includeMic}
              </FieldLabel>
            </Field>
          )}
        </studio.settingsForm.Field>

        <studio.settingsForm.Field name="trackInputEvents">
          {(field) => (
            <Field>
              <FieldLabel className="gg-inspector-toggle-row">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <MousePointer className="h-4 w-4" /> {studio.ui.labels.trackInput}
              </FieldLabel>
            </Field>
          )}
        </studio.settingsForm.Field>

        <studio.settingsForm.Field name="captureFps">
          {(field) => (
            <Field>
              <FieldLabel>{studio.ui.labels.captureFrameRate}</FieldLabel>
              <FieldContent>
                <Select
                  value={String(field.state.value)}
                  onValueChange={(value) => {
                    const captureFrameRate = parseCaptureFrameRate(value);
                    if (captureFrameRate != null) {
                      field.handleChange(captureFrameRate);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {captureFpsOptions.map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          )}
        </studio.settingsForm.Field>

        <div className="space-y-1 px-0.5">
          <p className="gg-utility-label">{studio.ui.labels.sourceMonitor}</p>
          <div className="gg-copy-meta space-y-1">
            <div>{`${studio.ui.labels.display}: ${captureSource === "display" ? studio.ui.values.on : studio.ui.values.off}`}</div>
            <div>{`${studio.ui.labels.window}: ${captureSource === "window" ? studio.ui.values.on : studio.ui.values.off}`}</div>
            <div>{`${studio.ui.labels.microphone}: ${studio.settingsForm.state.values.micEnabled ? studio.ui.values.on : studio.ui.values.off}`}</div>
            <div>{`${studio.ui.labels.captureFrameRate}: ${studio.settingsForm.state.values.captureFps} fps`}</div>
            <div>{`${studio.ui.labels.achievedFps}: ${telemetryPresentation.achievedFps}`}</div>
            <div>{`${studio.ui.labels.droppedFrames}: ${telemetryPresentation.droppedFrames}`}</div>
            <div>{`${studio.ui.labels.sourceDroppedFrames}: ${telemetryPresentation.sourceDroppedFrames}`}</div>
            <div>{`${studio.ui.labels.writerDroppedFrames}: ${telemetryPresentation.writerDroppedFrames}`}</div>
            <div>{`${studio.ui.labels.writerBackpressureDrops}: ${telemetryPresentation.writerBackpressureDrops}`}</div>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.effects.toUpperCase()}>
        <AutoZoomSection
          showMinimumKeyframeInterval
          showAudioMixer
          sliderClassName="gg-inspector-slider"
        />
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.advanced.toUpperCase()}>
        <studio.settingsForm.Field name="singleKeyShortcutsEnabled">
          {(field) => (
            <Field>
              <FieldLabel className="gg-inspector-toggle-row">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <Keyboard className="h-4 w-4" /> {studio.ui.labels.singleKeyShortcuts}
              </FieldLabel>
              <FieldDescription className="px-1.5 pt-0.5">
                {studio.ui.helper.singleKeyShortcuts}
              </FieldDescription>
            </Field>
          )}
        </studio.settingsForm.Field>
      </InspectorSection>
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

function parseCaptureFrameRate(value: string | null): CaptureFrameRate | null {
  if (value == null) {
    return null;
  }
  const parsedValue = Number(value);
  for (const frameRate of captureFrameRates) {
    if (frameRate === parsedValue) {
      return frameRate;
    }
  }
  return null;
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
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="gg-copy-strong">{label}</span>
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
        className="gg-inspector-slider"
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
      <InspectorSection title={studio.ui.inspectorTabs.project.toUpperCase()}>
        {selection.kind === "timelineClip" ? (
          <div className="flex flex-wrap gap-1.5">
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
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => studio.setPlayheadSeconds(selection.timestampSeconds)}
            >
              {studio.ui.inspector.actions.jumpPlayheadToMarker}
            </Button>
          </div>
        ) : null}

        {selection.kind === "none" ? (
          <p className="gg-copy-meta">{studio.ui.helper.activePreviewBody}</p>
        ) : null}
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.effects.toUpperCase()}>
        <AutoZoomSection headingIcon={<Sparkles className="h-3.5 w-3.5" />} />
      </InspectorSection>
    </>
  );
}

function DeliverInspectorContent() {
  const studio = useStudio();

  return (
    <>
      <InspectorSection title={studio.ui.inspector.cards.activePreset}>
        <InspectorDetailList>
          <InspectorDetailRow value={studio.selectedPreset?.name ?? "-"} />
          {studio.selectedPreset ? (
            <InspectorDetailRow
              className="text-muted-foreground"
              value={studio.formatAspectRatio(
                studio.selectedPreset.width,
                studio.selectedPreset.height,
              )}
            />
          ) : null}
        </InspectorDetailList>
      </InspectorSection>

      <InspectorSection title={studio.ui.inspector.cards.trimWindow}>
        <InspectorDetailList>
          <InspectorDetailRow
            value={`${studio.ui.labels.trimInSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimStartSeconds)}`}
          />
          <InspectorDetailRow
            value={`${studio.ui.labels.trimOutSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimEndSeconds)}`}
          />
        </InspectorDetailList>
      </InspectorSection>
    </>
  );
}

export function InspectorPanel({ mode }: InspectorPanelProps) {
  const studio = useStudio();
  const selection = studio.inspectorSelection;
  const view = useMemo(() => resolveInspectorView(mode, selection), [mode, selection]);
  const viewText = studio.ui.inspector.views[view.id];

  return (
    <StudioPane side="right">
      <StudioPaneHeader>
        <StudioPaneTitle className="flex items-center gap-2">
          <MonitorCog className="h-4 w-4" /> {viewText.title}
        </StudioPaneTitle>
        <StudioPaneSubtitle>{viewText.subtitle}</StudioPaneSubtitle>
      </StudioPaneHeader>
      <StudioPaneBody className="gg-inspector-pane-body gg-copy-compact">
        {selection.kind !== "none" ? <SelectionDetails selection={selection} /> : null}

        {mode === "capture" ? <CaptureInspectorContent /> : null}
        {mode === "edit" ? <EditInspectorContent selection={selection} /> : null}
        {mode === "deliver" ? <DeliverInspectorContent /> : null}
      </StudioPaneBody>
    </StudioPane>
  );
}
