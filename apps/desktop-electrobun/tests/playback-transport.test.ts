import { describe, expect, test } from "bun:test";
import {
  advancePlaybackSeconds,
  createPlaybackTransportStore,
  toDisplayClockSeconds,
  toEditClockSeconds,
} from "@studio/hooks/timeline/usePlaybackTransport";
import {
  frameIndexToSeconds,
  quantizeSecondsToFrame,
  secondsToFrameIndex,
} from "@studio/domain/timelineFrameTimebase";

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

  test("playback transport store updates snapshots without React state", () => {
    const store = createPlaybackTransportStore({
      durationSeconds: 10,
      frameRate: 30,
    });
    const notifications: number[] = [];
    const unsubscribe = store.subscribe(() => {
      notifications.push(store.getSnapshot().playheadSeconds);
    });

    store.play();
    store.advance(250);
    store.setRate(2);
    store.advance(250);

    const snapshot = store.getSnapshot();
    expect(snapshot.isPlaying).toBe(true);
    expect(snapshot.playbackRate).toBe(2);
    expect(snapshot.playheadSeconds).toBeCloseTo(0.75, 3);
    expect(snapshot.editPlayheadSeconds).toBeCloseTo(23 / 30, 6);
    expect(notifications.length).toBeGreaterThanOrEqual(3);

    unsubscribe();
  });
});
