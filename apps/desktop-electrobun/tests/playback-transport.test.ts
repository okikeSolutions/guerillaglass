import { describe, expect, test } from "bun:test";
import {
  advancePlaybackSeconds,
  toDisplayClockSeconds,
  toEditClockSeconds,
} from "../src/mainview/app/studio/hooks/timeline/usePlaybackTransport";
import {
  frameIndexToSeconds,
  quantizeSecondsToFrame,
  secondsToFrameIndex,
} from "../src/mainview/app/studio/model/timelineFrameTimebase";

describe("playback transport", () => {
  test("advances display clock continuously based on elapsed milliseconds", () => {
    const next = advancePlaybackSeconds({
      currentSeconds: 1.2,
      elapsedMs: 250,
      playbackRate: 1.5,
      durationSeconds: 10,
    });

    expect(next).toBeCloseTo(1.575, 3);
  });

  test("frame quantization maps trim/blade targets to timebase frame boundaries", () => {
    const frameRate = 60;
    const sourceSeconds = 0.1042;
    const frameIndex = secondsToFrameIndex(sourceSeconds, frameRate);
    const quantizedSeconds = frameIndexToSeconds(frameIndex, frameRate);

    expect(frameIndex).toBe(6);
    expect(quantizedSeconds).toBeCloseTo(0.1, 4);
    expect(quantizeSecondsToFrame(sourceSeconds, frameRate)).toBeCloseTo(0.1, 4);
  });

  test("playback display clock does not snap while edit clock remains frame-quantized", () => {
    const frameRate = 30;
    const sampledPlaybackSeconds = 0.041;
    const durationSeconds = 120;

    const displaySeconds = toDisplayClockSeconds(sampledPlaybackSeconds, durationSeconds);
    const editSeconds = toEditClockSeconds(sampledPlaybackSeconds, durationSeconds, frameRate);

    expect(displaySeconds).toBeCloseTo(0.041, 6);
    expect(editSeconds).toBeCloseTo(1 / 30, 6);
    expect(displaySeconds).not.toBe(editSeconds);
  });
});
