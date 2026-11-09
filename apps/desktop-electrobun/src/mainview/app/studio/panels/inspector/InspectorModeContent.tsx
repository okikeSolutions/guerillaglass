import * as m from "../../../../../paraglide/messages.js";
import { Mic, MousePointer, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { buildCaptureTelemetryPresentation } from "../../view-model/captureTelemetryViewModel";
import type { StudioController } from "../../hooks/core/useStudioController";
import {
  InspectorColorField,
  InspectorDetailRows,
  InspectorNumericField,
  InspectorOptionCard,
  InspectorOptionHeader,
  InspectorSection,
  InspectorSelectField,
  InspectorSliderField,
  InspectorToggleField,
  parseCaptureFrameRate,
} from "./InspectorPrimitives";

type InspectorModeStudio = Pick<
  StudioController,
  | "audioMixer"
  | "backgroundFramingSupported"
  | "captureStatusQuery"
  | "isRunningAction"
  | "exportForm"
  | "formatAspectRatio"
  | "formatDecimal"
  | "formatInteger"
  | "selectedPreset"
  | "setAudioMixerGain"
  | "setPlayheadSeconds"
  | "settingsForm"
  | "supportedCaptureFrameRates"
  | "toggleAudioMixerMuted"
  | "ui"
  | "locale"
  | "timelineItems"
  | "beginVisualEdit"
  | "commitVisualEdit"
>;

type AutoZoomSectionProps = {
  studio: InspectorModeStudio;
  headingIcon?: ReactNode;
  showMinimumKeyframeInterval?: boolean;
  sliderClassName?: string;
};

function AutoZoomSection({
  studio,
  headingIcon,
  showMinimumKeyframeInterval = false,
  sliderClassName,
}: AutoZoomSectionProps) {
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

          <InspectorSliderField
            onValueChangeStart={studio.beginVisualEdit}
            onValueCommitted={studio.commitVisualEdit}
            icon={headingIcon}
            label={studio.ui.labels.autoZoomIntensity(
              Math.round(field.state.value.intensity * 100),
            )}
            value={field.state.value.intensity}
            displayValue={`${Math.round(field.state.value.intensity * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            className={sliderClassName}
            onValueChange={(value) =>
              field.handleChange({
                ...field.state.value,
                intensity: value,
              })
            }
          />

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
        </div>
      )}
    </studio.settingsForm.Field>
  );
}

function BackgroundFramingSection({ studio }: { studio: InspectorModeStudio }) {
  return (
    <studio.settingsForm.Field name="backgroundFraming">
      {(field) => (
        <div className="space-y-2 px-0.5">
          <p className="gg-utility-label">{studio.ui.labels.backgroundFraming}</p>
          <InspectorToggleField
            label={studio.ui.labels.backgroundFraming}
            checked={field.state.value.enabled}
            onCheckedChange={(enabled) => field.handleChange({ ...field.state.value, enabled })}
          />
          <InspectorColorField
            label={studio.ui.labels.backgroundColor}
            value={field.state.value.backgroundColor}
            onValueChange={(backgroundColor) =>
              field.handleChange({ ...field.state.value, backgroundColor })
            }
          />
          <InspectorSliderField
            onValueChangeStart={studio.beginVisualEdit}
            onValueCommitted={studio.commitVisualEdit}
            label={studio.ui.labels.backgroundPadding}
            value={field.state.value.paddingFraction}
            displayValue={`${Math.round(field.state.value.paddingFraction * 100)}%`}
            min={0}
            max={0.25}
            step={0.01}
            onValueChange={(paddingFraction) =>
              field.handleChange({ ...field.state.value, paddingFraction })
            }
          />
          <InspectorSliderField
            onValueChangeStart={studio.beginVisualEdit}
            onValueCommitted={studio.commitVisualEdit}
            label={studio.ui.labels.cornerRoundness}
            value={field.state.value.cornerRadiusFraction}
            displayValue={`${Math.round(field.state.value.cornerRadiusFraction * 1000) / 10}%`}
            min={0}
            max={0.1}
            step={0.005}
            onValueChange={(cornerRadiusFraction) =>
              field.handleChange({ ...field.state.value, cornerRadiusFraction })
            }
          />
          <InspectorSliderField
            onValueChangeStart={studio.beginVisualEdit}
            onValueCommitted={studio.commitVisualEdit}
            label={studio.ui.labels.shadowStrength}
            value={field.state.value.shadowStrength}
            displayValue={`${Math.round(field.state.value.shadowStrength * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            onValueChange={(shadowStrength) =>
              field.handleChange({ ...field.state.value, shadowStrength })
            }
          />
        </div>
      )}
    </studio.settingsForm.Field>
  );
}

export function CaptureInspectorContent({ studio }: { studio: InspectorModeStudio }) {
  const captureSettingsLocked =
    Boolean(studio.captureStatusQuery.data?.isRunning) || studio.isRunningAction;
  const captureSource = studio.settingsForm.state.values.captureSource;
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const telemetryPresentation = buildCaptureTelemetryPresentation(telemetry, {
    formatInteger: studio.formatInteger,
    formatDecimal: studio.formatDecimal,
  });

  return (
    <>
      <InspectorSection defaultOpen title={studio.ui.inspectorTabs.capture}>
        <studio.settingsForm.Field name="micEnabled">
          {(field) => (
            <InspectorToggleField
              disabled={captureSettingsLocked}
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
              disabled={captureSettingsLocked}
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
              disabled={captureSettingsLocked}
              label={studio.ui.labels.captureFrameRate}
              value={String(field.state.value)}
              options={studio.supportedCaptureFrameRates.map((fps) => ({
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

        <details className="space-y-2 px-0.5">
          <summary className="gg-utility-label">
            {m.ui_workflow_diagnostics(undefined, { locale: studio.locale })}
          </summary>
          <InspectorDetailRows
            rows={[
              {
                label: studio.ui.labels.display,
                value: captureSource === "display" ? studio.ui.values.on : studio.ui.values.off,
              },
              {
                label: studio.ui.labels.window,
                value: captureSource === "window" ? studio.ui.values.on : studio.ui.values.off,
              },
              {
                label: studio.ui.labels.microphone,
                value: studio.settingsForm.state.values.micEnabled
                  ? studio.ui.values.on
                  : studio.ui.values.off,
              },
              {
                label: studio.ui.labels.captureFrameRate,
                value: `${studio.settingsForm.state.values.captureFps} fps`,
              },
              { label: studio.ui.labels.achievedFps, value: telemetryPresentation.achievedFps },
              {
                label: studio.ui.labels.sourceDroppedFrames,
                value: telemetryPresentation.sourceDroppedFrames,
              },
              {
                label: studio.ui.labels.writerDroppedFrames,
                value: telemetryPresentation.writerDroppedFrames,
              },
              {
                label: studio.ui.labels.writerBackpressureDrops,
                value: telemetryPresentation.writerBackpressureDrops,
              },
              {
                label: studio.ui.labels.captureCallback,
                value: telemetryPresentation.captureCallback,
              },
              {
                label: studio.ui.labels.recordQueueLag,
                value: telemetryPresentation.recordQueueLag,
              },
              {
                label: studio.ui.labels.writerAppend,
                value: telemetryPresentation.writerAppend,
              },
            ]}
          />
        </details>
      </InspectorSection>

      <InspectorSection defaultOpen title={studio.ui.inspectorTabs.effects}>
        <AutoZoomSection
          studio={studio}
          showMinimumKeyframeInterval
          sliderClassName="gg-inspector-slider"
        />
        {studio.backgroundFramingSupported ? <BackgroundFramingSection studio={studio} /> : null}
      </InspectorSection>
    </>
  );
}

export function EditInspectorContent({ studio }: { studio: InspectorModeStudio }) {
  return (
    <>
      <InspectorSection defaultOpen title={studio.ui.inspectorTabs.project}>
        <InspectorOptionCard>
          <InspectorOptionHeader
            title={m.ui_workflow_project_appearance(undefined, { locale: studio.locale })}
            description={m.ui_workflow_project_appearance_help(undefined, {
              locale: studio.locale,
            })}
          />
        </InspectorOptionCard>
      </InspectorSection>

      <InspectorSection defaultOpen title={studio.ui.inspectorTabs.effects}>
        <AutoZoomSection studio={studio} headingIcon={<Sparkles className="h-3.5 w-3.5" />} />
        {studio.backgroundFramingSupported ? <BackgroundFramingSection studio={studio} /> : null}
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
            { label: studio.ui.labels.preset, value: studio.selectedPreset?.name ?? "-" },
            ...(studio.selectedPreset
              ? [
                  {
                    label: studio.ui.labels.captureResolution,
                    value: studio.formatAspectRatio(
                      studio.selectedPreset.width,
                      studio.selectedPreset.height,
                    ),
                    valueClassName: "text-muted-foreground",
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
              label: studio.ui.labels.trimInSeconds,
              value: studio.formatDecimal(
                studio.exportForm.state.values.rangeMode === "full"
                  ? 0
                  : studio.exportForm.state.values.trimStartSeconds,
              ),
            },
            {
              label: studio.ui.labels.trimOutSeconds,
              value: studio.formatDecimal(
                studio.exportForm.state.values.rangeMode === "full"
                  ? (studio.timelineItems.slice(-1)[0]?.programEndSeconds ?? 0)
                  : studio.exportForm.state.values.trimEndSeconds,
              ),
            },
          ]}
        />
      </InspectorSection>
    </>
  );
}
