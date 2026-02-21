import type { CaptureStatusResult } from "@guerillaglass/engine-protocol";

type CaptureTargetLabelOptions = {
  metadata: CaptureStatusResult["captureMetadata"];
  displayLabel: string;
  windowLabel: string;
  untitledLabel: string;
  formatInteger: (value: number) => string;
};

export function captureTargetLabelFromMetadata(options: CaptureTargetLabelOptions): string | null {
  const { metadata, displayLabel, windowLabel, untitledLabel, formatInteger } = options;
  if (!metadata) {
    return null;
  }

  if (metadata.source === "display") {
    return displayLabel;
  }

  const windowLabelText =
    metadata.window == null
      ? windowLabel
      : `${metadata.window.appName} - ${metadata.window.title || untitledLabel}`;
  return `${windowLabelText} (${formatInteger(metadata.contentRect.width)}x${formatInteger(metadata.contentRect.height)})`;
}
