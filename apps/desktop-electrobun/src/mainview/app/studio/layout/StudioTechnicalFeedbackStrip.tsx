import { useMemo } from "react";
import { useStudio } from "../state/StudioProvider";
import { studioToneClass } from "../view-model/studioSemanticTone";
import { buildTechnicalFeedbackMetrics } from "../view-model/technicalFeedbackStripModel";

export function StudioTechnicalFeedbackStrip() {
  const studio = useStudio();
  const telemetry = studio.captureStatusQuery.data?.telemetry;

  const metrics = useMemo(
    () =>
      buildTechnicalFeedbackMetrics(
        telemetry,
        {
          sourceDroppedFrames: studio.ui.labels.sourceDroppedFrames,
          writerDroppedFrames: studio.ui.labels.writerDroppedFrames,
          writerBackpressureDrops: studio.ui.labels.writerBackpressureDrops,
          achievedFps: studio.ui.labels.achievedFps,
          cpuUsage: studio.ui.labels.cpuUsage,
          memoryUsage: studio.ui.labels.memoryUsage,
          recordingBitrate: studio.ui.labels.recordingBitrate,
          captureCallback: studio.ui.labels.captureCallback,
          recordQueueLag: studio.ui.labels.recordQueueLag,
          writerAppend: studio.ui.labels.writerAppend,
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
