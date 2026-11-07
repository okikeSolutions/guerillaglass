import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { Schema } from "effect";
import { timelineDocumentSchema } from "@guerillaglass/engine-contract/shared/valueObjects";
import { compileTimelineItems } from "../../src/mainview/app/studio/domain/timelineDomainModel";
import { createPlaybackTransportStore } from "../../src/mainview/app/studio/hooks/timeline/usePlaybackTransport";
import { useSceneCameraPreview } from "../../src/mainview/app/studio/hooks/useSceneCameraPreview";

test("source-time scene cameras update on seeks, clear in gaps, and differ on repeated footage", async () => {
  const store = createPlaybackTransportStore({ durationSeconds: 3, frameRate: 30 });
  const timelineItems = compileTimelineItems(
    Schema.decodeUnknownSync(timelineDocumentSchema)({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "left",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
          camera: [{ timeSeconds: 0, centerX: 0.25, centerY: 0.5, zoom: 2 }],
        },
        { kind: "gap", id: "pause", durationSeconds: 1 },
        {
          kind: "clip",
          id: "right",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
          camera: [{ timeSeconds: 0, centerX: 0.75, centerY: 0.5, zoom: 2 }],
        },
      ],
    }),
  );
  function Harness() {
    const mediaRef = useRef<HTMLVideoElement | null>(null);
    const sourceCardRef = useRef<HTMLDivElement | null>(null);
    useSceneCameraPreview({
      mediaRef,
      sourceCardRef,
      playbackStore: store,
      timelineItems,
      recordingMediaSource: "fixture",
    });
    return (
      <div data-framing-enabled="true">
        <div ref={sourceCardRef} style={{ width: 400, height: 225 }}>
          <video ref={mediaRef} />
        </div>
      </div>
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Harness />));
    const video = container.querySelector("video");
    if (!video) {
      throw new Error("Missing preview media");
    }
    Object.defineProperties(video, { videoWidth: { value: 1600 }, videoHeight: { value: 900 } });
    video.dispatchEvent(new Event("loadedmetadata"));
    await expect.poll(() => video.style.transform).toBe("matrix(2, 0, 0, 2, 200, 0)");
    const stage = container.querySelector("[data-framing-enabled]");
    if (!stage) {
      throw new Error("Missing preview stage");
    }
    stage.setAttribute("data-framing-enabled", "false");
    await expect.poll(() => video.parentElement?.style.overflow).toBe("visible");
    stage.setAttribute("data-framing-enabled", "true");
    await expect.poll(() => video.parentElement?.style.overflow).toBe("hidden");
    store.seek(1.5);
    expect(video.style.transform).toBe("");
    store.seek(2.5);
    expect(video.style.transform).toBe("matrix(2, 0, 0, 2, -200, 0)");
    expect(video.style.objectFit).toBe("contain");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
