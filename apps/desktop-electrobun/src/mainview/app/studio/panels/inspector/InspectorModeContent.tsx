import { Keyboard, Mic, MousePointer, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { captureFrameRates } from "@guerillaglass/engine-protocol";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { buildCaptureTelemetryPresentation } from "../../model/captureTelemetryViewModel";
import type { StudioController } from "../../hooks/core/useStudioController";
import {
  AudioMixerChannel,
  clampDbfsToMeter,
  InspectorDetailRows,
  InspectorNumericField,
  InspectorSection,
  InspectorSelectField,
  InspectorToggleField,
  parseCaptureFrameRate,
  readSliderValue,
} from "./InspectorPrimitives";

type InspectorModeStudio = Pick<
  StudioController,
  | "audioMixer"
  | "captureStatusQuery"
  | "exportForm"
  | "formatAspectRatio"
  | "formatDecimal"
  | "formatInteger"
  | "selectedPreset"
  | "setAudioMixerGain"
  | "setPlayheadSeconds"
  | "setTrimEndSeconds"
  | "setTrimStartSeconds"
  | "settingsForm"
  | "toggleAudioMixerMuted"
  | "ui"
>;

type AutoZoomSectionProps = {
  studio: InspectorModeStudio;
  headingIcon?: ReactNode;
  showMinimumKeyframeInterval?: boolean;
  showAudioMixer?: boolean;
  sliderClassName?: string;
};

function AutoZoomSection({
  studio,
  headingIcon,
  showMinimumKeyframeInterval = false,
  showAudioMixer = false,
  sliderClassName,
}: AutoZoomSectionProps) {
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

          <InspectorToggleField
            label={studio.ui.labels.autoZoomEnabled}
            checked={field.state.value.isEnabled}
            onCheckedChange={(checked) =>
              field.handleChange({
                ...field.state.value,
                isEnabled: checked,
              })
            }
          />

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
            <InspectorNumericField
              label={studio.ui.labels.minimumKeyframeInterval}
              min={0.01}
              step={0.01}
              value={Number(field.state.value.minimumKeyframeInterval.toFixed(2))}
              onValueChange={(value) =>
                field.handleChange({
                  ...field.state.value,
                  minimumKeyframeInterval: Math.max(0.01, value),
                })
              }
            />
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

export function CaptureInspectorContent({ studio }: { studio: InspectorModeStudio }) {
  const captureSource = studio.settingsForm.state.values.captureSource;
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const telemetryPresentation = buildCaptureTelemetryPresentation(telemetry, {
    formatInteger: studio.formatInteger,
    formatDecimal: studio.formatDecimal,
  });

  return (
    <>
      <InspectorSection title={studio.ui.inspectorTabs.capture.toUpperCase()}>
        <studio.settingsForm.Field name="micEnabled">
          {(field) => (
            <InspectorToggleField
              icon={<Mic className="h-4 w-4" />}
              label={studio.ui.labels.includeMic}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
          )}
        </studio.settingsForm.Field>

        <studio.settingsForm.Field name="trackInputEvents">
          {(field) => (
            <InspectorToggleField
              icon={<MousePointer className="h-4 w-4" />}
              label={studio.ui.labels.trackInput}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
          )}
        </studio.settingsForm.Field>

        <studio.settingsForm.Field name="captureFps">
          {(field) => (
            <InspectorSelectField
              label={studio.ui.labels.captureFrameRate}
              value={String(field.state.value)}
              options={captureFrameRates.map((fps) => ({
                value: String(fps),
                label: `${fps} fps`,
              }))}
              onValueChange={(value) => {
                const captureFrameRate = parseCaptureFrameRate(value);
                if (captureFrameRate != null) {
                  field.handleChange(captureFrameRate);
                }
              }}
            />
          )}
        </studio.settingsForm.Field>

        <div className="space-y-1 px-0.5">
          <p className="gg-utility-label">{studio.ui.labels.sourceMonitor}</p>
          <div className="gg-copy-meta">
            <InspectorDetailRows
              rows={[
                {
                  value: `${studio.ui.labels.display}: ${captureSource === "display" ? studio.ui.values.on : studio.ui.values.off}`,
                },
                {
                  value: `${studio.ui.labels.window}: ${captureSource === "window" ? studio.ui.values.on : studio.ui.values.off}`,
                },
                {
                  value: `${studio.ui.labels.microphone}: ${studio.settingsForm.state.values.micEnabled ? studio.ui.values.on : studio.ui.values.off}`,
                },
                {
                  value: `${studio.ui.labels.captureFrameRate}: ${studio.settingsForm.state.values.captureFps} fps`,
                },
                { value: `${studio.ui.labels.achievedFps}: ${telemetryPresentation.achievedFps}` },
                {
                  value: `${studio.ui.labels.droppedFrames}: ${telemetryPresentation.droppedFrames}`,
                },
                {
                  value: `${studio.ui.labels.sourceDroppedFrames}: ${telemetryPresentation.sourceDroppedFrames}`,
                },
                {
                  value: `${studio.ui.labels.writerDroppedFrames}: ${telemetryPresentation.writerDroppedFrames}`,
                },
                {
                  value: `${studio.ui.labels.writerBackpressureDrops}: ${telemetryPresentation.writerBackpressureDrops}`,
                },
              ]}
            />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.effects.toUpperCase()}>
        <AutoZoomSection
          studio={studio}
          showMinimumKeyframeInterval
          showAudioMixer
          sliderClassName="gg-inspector-slider"
        />
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.advanced.toUpperCase()}>
        <studio.settingsForm.Field name="singleKeyShortcutsEnabled">
          {(field) => (
            <InspectorToggleField
              icon={<Keyboard className="h-4 w-4" />}
              label={studio.ui.labels.singleKeyShortcuts}
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
              description={studio.ui.helper.singleKeyShortcuts}
            />
          )}
        </studio.settingsForm.Field>
      </InspectorSection>
    </>
  );
}

export function EditInspectorContent({ studio }: { studio: InspectorModeStudio }) {
  return (
    <>
      <InspectorSection title={studio.ui.inspectorTabs.project.toUpperCase()}>
        <p className="gg-copy-meta">{studio.ui.helper.activePreviewBody}</p>
      </InspectorSection>

      <InspectorSection title={studio.ui.inspectorTabs.effects.toUpperCase()}>
        <AutoZoomSection studio={studio} headingIcon={<Sparkles className="h-3.5 w-3.5" />} />
      </InspectorSection>
    </>
  );
}

export function DeliverInspectorContent({ studio }: { studio: InspectorModeStudio }) {
  return (
    <>
      <InspectorSection title={studio.ui.inspector.cards.activePreset}>
        <InspectorDetailRows
          rows={[
            { value: studio.selectedPreset?.name ?? "-" },
            ...(studio.selectedPreset
              ? [
                  {
                    value: studio.formatAspectRatio(
                      studio.selectedPreset.width,
                      studio.selectedPreset.height,
                    ),
                    className: "text-muted-foreground",
                  },
                ]
              : []),
          ]}
        />
      </InspectorSection>

      <InspectorSection title={studio.ui.inspector.cards.trimWindow}>
        <InspectorDetailRows
          rows={[
            {
              value: `${studio.ui.labels.trimInSeconds}: ${studio.formatDecimal(
                studio.exportForm.state.values.trimStartSeconds,
              )}`,
            },
            {
              value: `${studio.ui.labels.trimOutSeconds}: ${studio.formatDecimal(
                studio.exportForm.state.values.trimEndSeconds,
              )}`,
            },
          ]}
        />
      </InspectorSection>
    </>
  );
}
