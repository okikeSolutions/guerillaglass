import { useEffect, type RefObject } from "react";
import type { CompiledTimelineItem } from "../domain/timelineDomainModel";
import { resolveTimelinePlaybackAtProgramTime } from "../domain/timelinePlaybackModel";
import { sampleSceneCamera, sceneCameraCssTransform } from "../domain/sceneCamera";
import type { PlaybackTransportStore } from "./timeline/usePlaybackTransport";

/** Subscribes camera rendering to the display clock without a React render per video frame. */
export function useSceneCameraPreview({
  mediaRef,
  sourceCardRef,
  playbackStore,
  timelineItems,
  recordingMediaSource,
}: {
  mediaRef: RefObject<HTMLVideoElement | null>;
  sourceCardRef: RefObject<HTMLDivElement | null>;
  playbackStore: PlaybackTransportStore;
  timelineItems: CompiledTimelineItem[];
  recordingMediaSource: string | null;
}): void {
  useEffect(() => {
    const media = mediaRef.current;
    const card = sourceCardRef.current;
    if (!media || !card || !recordingMediaSource) {
      return;
    }
    const clear = () => {
      media.style.removeProperty("transform");
      media.style.removeProperty("transform-origin");
      media.style.removeProperty("object-fit");
      card.style.removeProperty("overflow");
    };
    const update = () => {
      const end = timelineItems[timelineItems.length - 1]?.programEndSeconds ?? 0;
      const time = Math.min(
        playbackStore.getSnapshot().playheadSeconds,
        Math.max(0, end - 0.000001),
      );
      const scene = resolveTimelinePlaybackAtProgramTime(timelineItems, time);
      const key =
        scene.kind === "clip" && scene.item.camera
          ? sampleSceneCamera(scene.item.camera, scene.sourceSeconds)
          : null;
      if (!key || !media.videoWidth || !media.videoHeight) {
        clear();
        return;
      }
      // Native legacy exports clip at the output stage; enabled framing clips at the card.
      card.style.overflow =
        card.closest("[data-framing-enabled]")?.getAttribute("data-framing-enabled") === "true"
          ? "hidden"
          : "visible";
      media.style.objectFit = "contain";
      media.style.transformOrigin = "50% 50%";
      media.style.transform = sceneCameraCssTransform(
        key,
        { width: media.videoWidth, height: media.videoHeight },
        { width: card.clientWidth, height: card.clientHeight },
      );
    };
    const unsubscribe = playbackStore.subscribe(update);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    const stage = card.closest("[data-framing-enabled]");
    const framingObserver = new MutationObserver(update);
    if (stage) {
      framingObserver.observe(stage, {
        attributes: true,
        attributeFilter: ["data-framing-enabled"],
      });
    }
    media.addEventListener("loadedmetadata", update);
    update();
    return () => {
      unsubscribe();
      observer.disconnect();
      framingObserver.disconnect();
      media.removeEventListener("loadedmetadata", update);
      clear();
    };
  }, [mediaRef, sourceCardRef, playbackStore, timelineItems, recordingMediaSource]);
}
