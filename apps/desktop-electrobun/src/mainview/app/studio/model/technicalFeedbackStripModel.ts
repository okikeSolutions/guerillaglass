import type { CaptureHealthReason, CaptureTelemetry } from "@guerillaglass/engine-protocol";
import { buildCaptureTelemetryPresentation } from "./captureTelemetryViewModel";
import { studioHealthTone, type StudioSemanticState } from "./studioSemanticTone";

export type TechnicalFeedbackFormatter = {
  formatInteger: (value: number) => string;
  formatDecimal: (value: number) => string;
};

export type TechnicalFeedbackLabels = {
  droppedFrames: string;
  cpuUsage: string;
  memoryUsage: string;
  recordingBitrate: string;
  audioLevel: string;
  health: string;
  good: string;
  warning: string;
  critical: string;
  healthReasonEngineError: string;
  healthReasonHighDroppedFrameRate: string;
  healthReasonElevatedDroppedFrameRate: string;
  healthReasonLowMicrophoneLevel: string;
};

export type TechnicalFeedbackMetric = {
  id: string;
  label: string;
  value: string;
  tone: StudioSemanticState;
};

export type TechnicalFeedbackValues = {
  droppedFrames: string;
  cpuUsage: string;
  memoryUsage: string;
  recordingBitrate: string;
  audioLevel: string;
  health: string;
  healthTone: StudioSemanticState;
  telemetryPresentation: ReturnType<typeof buildCaptureTelemetryPresentation>;
};

export type TelemetryHealthReasonLabels = Pick<
  TechnicalFeedbackLabels,
  | "healthReasonEngineError"
  | "healthReasonHighDroppedFrameRate"
  | "healthReasonElevatedDroppedFrameRate"
  | "healthReasonLowMicrophoneLevel"
>;

export function localizeTelemetryHealthReason(
  reason: CaptureHealthReason | null | undefined,
  labels: TelemetryHealthReasonLabels,
): string | null {
  if (reason == null) {
    return null;
  }

  switch (reason) {
    case "engine_error":
      return labels.healthReasonEngineError;
    case "high_dropped_frame_rate":
      return labels.healthReasonHighDroppedFrameRate;
    case "elevated_dropped_frame_rate":
      return labels.healthReasonElevatedDroppedFrameRate;
    case "low_microphone_level":
      return labels.healthReasonLowMicrophoneLevel;
  }
}

export function formatTelemetryMemoryBytes(
  memoryBytes: number | null | undefined,
  formatter: TechnicalFeedbackFormatter,
): string {
  if (memoryBytes == null || !Number.isFinite(memoryBytes) || memoryBytes < 0) {
    return "-";
  }

  const gibibytes = memoryBytes / 1024 ** 3;
  if (gibibytes >= 1) {
    return `${formatter.formatDecimal(gibibytes)} GiB`;
  }

  const mebibytes = memoryBytes / 1024 ** 2;
  return `${formatter.formatDecimal(mebibytes)} MiB`;
}

export function formatTelemetryCpuPercent(
  cpuPercent: number | null | undefined,
  formatter: TechnicalFeedbackFormatter,
): string {
  if (cpuPercent == null || !Number.isFinite(cpuPercent) || cpuPercent < 0) {
    return "-";
  }
  return `${formatter.formatDecimal(cpuPercent)}%`;
}

export function formatTelemetryBitrateMbps(
  bitrateMbps: number | null | undefined,
  formatter: TechnicalFeedbackFormatter,
): string {
  if (bitrateMbps == null || !Number.isFinite(bitrateMbps) || bitrateMbps < 0) {
    return "-";
  }
  return `${formatter.formatDecimal(bitrateMbps)} Mbps`;
}

export function formatTelemetryAudioLevel(
  audioLevelDbfs: number | null | undefined,
  formatter: TechnicalFeedbackFormatter,
): string {
  if (audioLevelDbfs == null || !Number.isFinite(audioLevelDbfs)) {
    return "-";
  }
  return `${formatter.formatDecimal(audioLevelDbfs)} dBFS`;
}

export function buildTechnicalFeedbackMetrics(
  telemetry: CaptureTelemetry | undefined,
  labels: TechnicalFeedbackLabels,
  formatter: TechnicalFeedbackFormatter,
): TechnicalFeedbackMetric[] {
  const values = buildTechnicalFeedbackValues(telemetry, labels, formatter);

  return [
    {
      id: "dropped-frames",
      label: labels.droppedFrames,
      value: values.droppedFrames,
      tone: "neutral",
    },
    {
      id: "cpu-usage",
      label: labels.cpuUsage,
      value: values.cpuUsage,
      tone: "neutral",
    },
    {
      id: "memory-usage",
      label: labels.memoryUsage,
      value: values.memoryUsage,
      tone: "neutral",
    },
    {
      id: "recording-bitrate",
      label: labels.recordingBitrate,
      value: values.recordingBitrate,
      tone: "neutral",
    },
    {
      id: "audio-level",
      label: labels.audioLevel,
      value: values.audioLevel,
      tone: "neutral",
    },
    {
      id: "health",
      label: labels.health,
      value: values.health,
      tone: values.healthTone,
    },
  ];
}

export function buildTechnicalFeedbackValues(
  telemetry: CaptureTelemetry | undefined,
  labels: TechnicalFeedbackLabels,
  formatter: TechnicalFeedbackFormatter,
): TechnicalFeedbackValues {
  const telemetryPresentation = buildCaptureTelemetryPresentation(telemetry, formatter);
  const health = telemetry?.health ?? "good";
  const healthLabel =
    health === "critical" ? labels.critical : health === "warning" ? labels.warning : labels.good;
  const healthReason = localizeTelemetryHealthReason(telemetry?.healthReason, labels);

  return {
    droppedFrames: telemetryPresentation.droppedFrames,
    cpuUsage: formatTelemetryCpuPercent(telemetry?.cpuPercent, formatter),
    memoryUsage: formatTelemetryMemoryBytes(telemetry?.memoryBytes, formatter),
    recordingBitrate: formatTelemetryBitrateMbps(telemetry?.recordingBitrateMbps, formatter),
    audioLevel: formatTelemetryAudioLevel(telemetry?.audioLevelDbfs, formatter),
    health: healthReason ?? healthLabel,
    healthTone: studioHealthTone(health),
    telemetryPresentation,
  };
}
