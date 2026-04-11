import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";

export type TechnicalFeedbackTelemetrySource = {
  activeMode: "capture" | "edit" | "deliver";
  isCaptureRunning: boolean;
  isCaptureRecording: boolean;
  liveTelemetry: CaptureTelemetry | undefined;
  lastRecordingTelemetry: CaptureTelemetry | null | undefined;
  projectLastRecordingTelemetry: CaptureTelemetry | null | undefined;
};

export type TechnicalFeedbackFormatter = {
  formatInteger: (value: number) => string;
  formatDecimal: (value: number) => string;
};

export type TechnicalFeedbackLabels = {
  sourceDroppedFrames: string;
  writerDroppedFrames: string;
  writerBackpressureDrops: string;
  achievedFps: string;
  cpuUsage: string;
  memoryUsage: string;
  recordingBitrate: string;
  captureCallback: string;
  recordQueueLag: string;
  writerAppend: string;
};

export type TechnicalFeedbackMetric = {
  id: string;
  label: string;
  value: string;
  tone: "neutral";
};

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

function formatTelemetryDurationMs(
  durationMs: number | null | undefined,
  formatter: TechnicalFeedbackFormatter,
): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "-";
  }
  return `${formatter.formatDecimal(durationMs)} ms`;
}

export function buildTechnicalFeedbackMetrics(
  telemetry: CaptureTelemetry | undefined,
  labels: TechnicalFeedbackLabels,
  formatter: TechnicalFeedbackFormatter,
): TechnicalFeedbackMetric[] {
  return [
    {
      id: "source-drops",
      label: labels.sourceDroppedFrames,
      value: formatter.formatInteger(telemetry?.sourceDroppedFrames ?? 0),
      tone: "neutral",
    },
    {
      id: "writer-drops",
      label: labels.writerDroppedFrames,
      value: formatter.formatInteger(telemetry?.writerDroppedFrames ?? 0),
      tone: "neutral",
    },
    {
      id: "writer-backpressure",
      label: labels.writerBackpressureDrops,
      value: formatter.formatInteger(telemetry?.writerBackpressureDrops ?? 0),
      tone: "neutral",
    },
    {
      id: "achieved-fps",
      label: labels.achievedFps,
      value: `${formatter.formatDecimal(telemetry?.achievedFps ?? 0)} fps`,
      tone: "neutral",
    },
    {
      id: "cpu-usage",
      label: labels.cpuUsage,
      value: formatTelemetryCpuPercent(telemetry?.cpuPercent, formatter),
      tone: "neutral",
    },
    {
      id: "memory-usage",
      label: labels.memoryUsage,
      value: formatTelemetryMemoryBytes(telemetry?.memoryBytes, formatter),
      tone: "neutral",
    },
    {
      id: "recording-bitrate",
      label: labels.recordingBitrate,
      value: formatTelemetryBitrateMbps(telemetry?.recordingBitrateMbps, formatter),
      tone: "neutral",
    },
    {
      id: "capture-callback",
      label: labels.captureCallback,
      value: formatTelemetryDurationMs(telemetry?.captureCallbackMs, formatter),
      tone: "neutral",
    },
    {
      id: "record-queue-lag",
      label: labels.recordQueueLag,
      value: formatTelemetryDurationMs(telemetry?.recordQueueLagMs, formatter),
      tone: "neutral",
    },
    {
      id: "writer-append",
      label: labels.writerAppend,
      value: formatTelemetryDurationMs(telemetry?.writerAppendMs, formatter),
      tone: "neutral",
    },
  ];
}

export function resolveTechnicalFeedbackTelemetry(
  source: TechnicalFeedbackTelemetrySource,
): CaptureTelemetry | undefined {
  if (source.activeMode === "capture") {
    if (source.isCaptureRunning || source.isCaptureRecording) {
      return source.liveTelemetry;
    }
    return source.lastRecordingTelemetry ?? source.projectLastRecordingTelemetry ?? undefined;
  }

  if (source.activeMode === "edit" && !source.isCaptureRunning && !source.isCaptureRecording) {
    return source.lastRecordingTelemetry ?? source.projectLastRecordingTelemetry ?? undefined;
  }

  return undefined;
}
