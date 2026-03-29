import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";

type TelemetryFormatter = {
  formatInteger: (value: number) => string;
  formatDecimal: (value: number) => string;
};

type TelemetryLabels = {
  sourceDroppedFrames: string;
  writerDroppedFrames: string;
  writerBackpressureDrops: string;
  achievedFps: string;
  captureCallback: string;
  recordQueueLag: string;
  writerAppend: string;
};

export type CaptureTelemetryPresentation = {
  sourceDroppedFrames: string;
  writerDroppedFrames: string;
  writerBackpressureDrops: string;
  achievedFps: string;
  captureCallback: string;
  recordQueueLag: string;
  writerAppend: string;
};

export function buildCaptureTelemetryPresentation(
  telemetry: CaptureTelemetry | undefined,
  formatter: TelemetryFormatter,
): CaptureTelemetryPresentation {
  return {
    sourceDroppedFrames: formatter.formatInteger(telemetry?.sourceDroppedFrames ?? 0),
    writerDroppedFrames: formatter.formatInteger(telemetry?.writerDroppedFrames ?? 0),
    writerBackpressureDrops: formatter.formatInteger(telemetry?.writerBackpressureDrops ?? 0),
    achievedFps: `${formatter.formatDecimal(telemetry?.achievedFps ?? 0)} fps`,
    captureCallback: `${formatter.formatDecimal(telemetry?.captureCallbackMs ?? 0)} ms`,
    recordQueueLag: `${formatter.formatDecimal(telemetry?.recordQueueLagMs ?? 0)} ms`,
    writerAppend: `${formatter.formatDecimal(telemetry?.writerAppendMs ?? 0)} ms`,
  };
}

export function buildDroppedFramesTooltip(
  labels: TelemetryLabels,
  presentation: CaptureTelemetryPresentation,
): string {
  return (
    `${labels.sourceDroppedFrames}: ${presentation.sourceDroppedFrames} | ` +
    `${labels.writerDroppedFrames}: ${presentation.writerDroppedFrames} | ` +
    `${labels.writerBackpressureDrops}: ${presentation.writerBackpressureDrops} | ` +
    `${labels.achievedFps}: ${presentation.achievedFps} | ` +
    `${labels.captureCallback}: ${presentation.captureCallback} | ` +
    `${labels.recordQueueLag}: ${presentation.recordQueueLag} | ` +
    `${labels.writerAppend}: ${presentation.writerAppend}`
  );
}
