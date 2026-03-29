export const defaultTimelineFrameRate = 30;

export function normalizeTimelineFrameRate(frameRate: number): number {
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    return defaultTimelineFrameRate;
  }
  return frameRate;
}

export function secondsToFrameIndex(seconds: number, frameRate: number): number {
  const normalizedFrameRate = normalizeTimelineFrameRate(frameRate);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.round(seconds * normalizedFrameRate);
}

export function frameIndexToSeconds(frameIndex: number, frameRate: number): number {
  const normalizedFrameRate = normalizeTimelineFrameRate(frameRate);
  if (!Number.isFinite(frameIndex) || frameIndex <= 0) {
    return 0;
  }
  return frameIndex / normalizedFrameRate;
}

export function quantizeSecondsToFrame(seconds: number, frameRate: number): number {
  return frameIndexToSeconds(secondsToFrameIndex(seconds, frameRate), frameRate);
}
