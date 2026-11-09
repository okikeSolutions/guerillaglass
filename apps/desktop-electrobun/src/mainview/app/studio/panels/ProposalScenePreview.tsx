import { useEffect, useRef, useState } from "react";
import type {
  BackgroundFramingSettings,
  TimelineItem,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import type { StudioLocale } from "@shared/localization";
import { Button } from "@guerillaglass/ui/components/button";
import * as m from "../../../../paraglide/messages.js";
import { useRecordingMediaSourceLease } from "../hooks/useRecordingMediaSource";
import { sampleSceneCamera, sceneCameraCssTransform } from "../domain/sceneCamera";
import { BackgroundFramingPreview } from "./BackgroundFramingPreview";

type ProposalScenePreviewProps = {
  item: TimelineItem;
  locale: StudioLocale;
  recordingURL: string;
  framing: BackgroundFramingSettings;
  outputSize: { width: number; height: number };
  cameraReframeEnabled: boolean;
};

/** Isolated scene playback never writes to the draft or main program transport. */
export function ProposalScenePreview(props: ProposalScenePreviewProps) {
  const { source, error } = useRecordingMediaSourceLease(props.recordingURL);
  // A different scene or renewed source starts a fresh isolated playback session.
  // This also recovers after a previous scene's media error removed its video.
  return (
    <ScenePlayback
      key={JSON.stringify([props.item, source])}
      {...props}
      source={source}
      error={error}
    />
  );
}

function ScenePlayback({
  item,
  locale,
  framing,
  outputSize,
  cameraReframeEnabled,
  source,
  error,
}: ProposalScenePreviewProps & { source: string | null; error: Error | null }) {
  const options = { locale };
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(0);
  const [sourceSize, setSourceSize] = useState(outputSize);
  const start = item.kind === "clip" ? item.sourceStartSeconds : 0;
  const duration = item.kind === "clip" ? item.sourceEndSeconds - start : item.durationSeconds;
  useEffect(() => {
    const video = videoRef.current;
    const card = cardRef.current;
    if (!video || !card || item.kind !== "clip") {
      return;
    }
    let lastDisplayUpdate = 0;
    let boundaryFrame = 0;
    let disposed = false;
    const update = (sourceTime = video.currentTime, force = false) => {
      const time = Math.min(Math.max(sourceTime, start), item.sourceEndSeconds);
      const key = item.camera ? sampleSceneCamera(item.camera, time) : null;
      video.style.transform =
        key && video.videoWidth && video.videoHeight
          ? sceneCameraCssTransform(
              key,
              { width: video.videoWidth, height: video.videoHeight },
              { width: card.clientWidth, height: card.clientHeight },
            )
          : "none";
      const now = performance.now();
      if (force || now - lastDisplayUpdate >= 100) {
        setPosition(time - start);
        lastDisplayUpdate = now;
      }
    };
    const ready = () => {
      video.currentTime = start;
      setSourceSize({ width: video.videoWidth, height: video.videoHeight });
      update(video.currentTime, true);
    };
    const sync = () => update(video.currentTime, true);
    // Camera motion follows the continuous source clock, even between repeated
    // decoded frames. A late decoded-frame callback must never overwrite the
    // endpoint camera after a bounded seek.
    const boundPlayback = () => {
      if (disposed) {
        return;
      }
      if (!video.paused && video.currentTime >= item.sourceEndSeconds) {
        video.pause();
        video.currentTime = Math.max(start, item.sourceEndSeconds - 0.000001);
        update(video.currentTime, true);
      }
      update();
      boundaryFrame = requestAnimationFrame(boundPlayback);
    };
    boundaryFrame = requestAnimationFrame(boundPlayback);
    const resize = new ResizeObserver(sync);
    resize.observe(card);
    video.addEventListener("loadedmetadata", ready);
    video.addEventListener("seeked", sync);
    if (video.readyState >= 1) {
      ready();
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(boundaryFrame);
      video.pause();
      resize.disconnect();
      video.removeEventListener("loadedmetadata", ready);
      video.removeEventListener("seeked", sync);
    };
  }, [item, source, start, error, failed]);
  if (item.kind === "gap") {
    return (
      <p className="p-6 text-sm">
        {m.ui_agent_gap(undefined, options)} · {duration.toFixed(2)} s
      </p>
    );
  }
  if (error || failed) {
    return <p role="alert">{m.ui_agent_media_error(undefined, options)}</p>;
  }
  return (
    <div className="grid gap-3">
      <div style={{ aspectRatio: `${outputSize.width}/${outputSize.height}` }}>
        <BackgroundFramingPreview
          settings={framing}
          outputSize={outputSize}
          sourceSize={sourceSize}
          cameraReframeEnabled={cameraReframeEnabled}
          cardRef={cardRef}
        >
          {source ? (
            <video
              ref={videoRef}
              src={source}
              className="h-full w-full object-contain"
              muted
              playsInline
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setFailed(true)}
            />
          ) : null}
        </BackgroundFramingPreview>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!source}
          onClick={() => {
            const video = videoRef.current;
            if (!video) {
              return;
            }
            if (playing) {
              video.pause();
            } else {
              if (video.currentTime >= item.sourceEndSeconds - 0.01) {
                video.currentTime = start;
              }
              void video.play().catch(() => setFailed(true));
            }
          }}
        >
          {playing ? m.ui_agent_pause(undefined, options) : m.ui_agent_play(undefined, options)}
        </Button>
        <label className="grid flex-1 gap-1 text-xs">
          {m.ui_agent_position(undefined, options)} · {position.toFixed(2)} / {duration.toFixed(2)}{" "}
          s
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={position}
            disabled={!source}
            onChange={(event) => {
              const video = videoRef.current;
              if (video) {
                video.currentTime = start + Number(event.target.value);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
