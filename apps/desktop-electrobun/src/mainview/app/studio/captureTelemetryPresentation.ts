import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";

type TelemetryFormatter = {
  formatInteger: (value: number) => string;
  formatDecimal: (value: number) => string;
};

type TelemetryLabels = {
  droppedFrames: string;
  sourceDroppedFrames: string;
  writerDroppedFrames: string;
  writerBackpressureDrops: string;
  achievedFps: string;
};

export type CaptureTelemetryPresentation = {
  droppedFrames: string;
  sourceDroppedFrames: string;
  writerDroppedFrames: string;
  writerBackpressureDrops: string;
  achievedFps: string;
};

export function buildCaptureTelemetryPresentation(
  telemetry: CaptureTelemetry | undefined,
  formatter: TelemetryFormatter,
): CaptureTelemetryPresentation {
  return {
    droppedFrames: `${formatter.formatInteger(telemetry?.droppedFrames ?? 0)} (${formatter.formatDecimal(
      telemetry?.droppedFramePercent ?? 0,
    )}%)`,
    sourceDroppedFrames: `${formatter.formatInteger(
      telemetry?.sourceDroppedFrames ?? 0,
    )} (${formatter.formatDecimal(telemetry?.sourceDroppedFramePercent ?? 0)}%)`,
    writerDroppedFrames: `${formatter.formatInteger(
      telemetry?.writerDroppedFrames ?? 0,
    )} (${formatter.formatDecimal(telemetry?.writerDroppedFramePercent ?? 0)}%)`,
    writerBackpressureDrops: formatter.formatInteger(telemetry?.writerBackpressureDrops ?? 0),
    achievedFps: `${formatter.formatDecimal(telemetry?.achievedFps ?? 0)} fps`,
  };
}

export function buildDroppedFramesTooltip(
  labels: TelemetryLabels,
  presentation: CaptureTelemetryPresentation,
): string {
  return (
    `${labels.droppedFrames}: ${presentation.droppedFrames} | ` +
    `${labels.sourceDroppedFrames}: ${presentation.sourceDroppedFrames} | ` +
    `${labels.writerDroppedFrames}: ${presentation.writerDroppedFrames} | ` +
    `${labels.writerBackpressureDrops}: ${presentation.writerBackpressureDrops} | ` +
    `${labels.achievedFps}: ${presentation.achievedFps}`
  );
}
