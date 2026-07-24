import type { BackgroundFramingSettings } from "@guerillaglass/engine-contract/shared/valueObjects";

export type RenderSize = Readonly<{ width: number; height: number }>;
export type RenderRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type BackgroundFramingGeometry = Readonly<{
  outputRect: RenderRect;
  cardRect: RenderRect;
  cornerRadius: number;
  shadowOpacity: number;
  shadowBlurRadius: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}>;

export function computeBackgroundFramingGeometry(
  outputSize: RenderSize,
  sourceSize: RenderSize,
  settings: BackgroundFramingSettings,
): BackgroundFramingGeometry | null {
  if (!isFinitePositiveSize(outputSize) || !isFinitePositiveSize(sourceSize)) {
    return null;
  }

  const outputRect = { x: 0, y: 0, width: outputSize.width, height: outputSize.height };
  const shorterOutputDimension = Math.min(outputSize.width, outputSize.height);
  const padding = settings.enabled ? settings.paddingFraction * shorterOutputDimension : 0;
  const availableWidth = outputSize.width - 2 * padding;
  const availableHeight = outputSize.height - 2 * padding;
  if (availableWidth <= 0 || availableHeight <= 0) {
    return null;
  }

  const scale = Math.min(availableWidth / sourceSize.width, availableHeight / sourceSize.height);
  const cardWidth = sourceSize.width * scale;
  const cardHeight = sourceSize.height * scale;
  const cardRect = {
    x: (outputSize.width - cardWidth) / 2,
    y: (outputSize.height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
  };
  const shadowStrength = settings.enabled ? settings.shadowStrength : 0;

  return {
    outputRect,
    cardRect,
    cornerRadius: settings.enabled
      ? settings.cornerRadiusFraction * Math.min(cardWidth, cardHeight)
      : 0,
    shadowOpacity: 0.3 * shadowStrength,
    shadowBlurRadius: 0.035 * shorterOutputDimension * shadowStrength,
    shadowOffsetX: 0,
    shadowOffsetY: 0.012 * shorterOutputDimension * shadowStrength,
  };
}

function isFinitePositiveSize(size: RenderSize): boolean {
  return (
    Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
  );
}
