import { useMemo } from "react";
import { useStudio } from "../state/StudioProvider";
import { studioToneClass } from "../model/studioSemanticTone";
import { buildTechnicalFeedbackMetrics } from "../model/technicalFeedbackStripModel";

export function StudioTechnicalFeedbackStrip() {
  const studio = useStudio();
  const telemetry = studio.captureStatusQuery.data?.telemetry;

  const metrics = useMemo(
    () =>
      buildTechnicalFeedbackMetrics(
        telemetry,
        {
          droppedFrames: studio.ui.labels.droppedFrames,
          cpuUsage: studio.ui.labels.cpuUsage,
          memoryUsage: studio.ui.labels.memoryUsage,
          recordingBitrate: studio.ui.labels.recordingBitrate,
          audioLevel: studio.ui.labels.audioLevel,
          health: studio.ui.labels.health,
          good: studio.ui.values.good,
          warning: studio.ui.values.warning,
          critical: studio.ui.values.critical,
          healthReasonEngineError: studio.ui.helper.healthReasonEngineError,
          healthReasonHighDroppedFrameRate: studio.ui.helper.healthReasonHighDroppedFrameRate,
          healthReasonElevatedDroppedFrameRate:
            studio.ui.helper.healthReasonElevatedDroppedFrameRate,
          healthReasonLowMicrophoneLevel: studio.ui.helper.healthReasonLowMicrophoneLevel,
        },
        {
          formatInteger: studio.formatInteger,
          formatDecimal: studio.formatDecimal,
        },
      ),
    [studio, telemetry],
  );

  return (
    <section
      className="gg-technical-feedback-strip px-4 py-1.5"
      aria-label={studio.ui.labels.technicalFeedback}
    >
      <ul className="gg-technical-feedback-list gg-copy-meta">
        {metrics.map((metric) => (
          <li
            key={metric.id}
            className={`gg-technical-feedback-item ${studioToneClass(metric.tone)}`}
          >
            <span className="gg-technical-feedback-label">{metric.label}</span>
            <span className="gg-technical-feedback-value gg-icon-tone">{metric.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
