import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const playbackSyncPath = path.join(
  repoRoot,
  "apps/desktop-electrobun/src/mainview/app/studio/hooks/useVideoPlaybackSync.ts",
);

describe("video playback clock source", () => {
  test("drives timeline playback from requestAnimationFrame instead of decoded video frames", async () => {
    const source = await readFile(playbackSyncPath, "utf8");

    expect(source).toContain("requestAnimationFrame");
    expect(source).not.toContain("requestVideoFrameCallback");
    expect(source).not.toContain("cancelVideoFrameCallback");
  });

  test("resets the gap wall-clock baseline when restarting the animation loop", async () => {
    const source = await readFile(playbackSyncPath, "utf8");

    expect(source).toContain("lastFrameTimeMs = performance.now();\n      loopActive = true;");
  });

  test("commits the playhead into the gap when crossing a clip-to-gap boundary", async () => {
    const source = await readFile(playbackSyncPath, "utf8");

    expect(source).toContain(
      'if (boundaryResolution.kind === "gap") {\n          media.pause();\n          setSourceVisibility(media, sourceCardRef, false);\n          setPlayheadSecondsFromMedia(boundarySeconds);',
    );
  });
});
