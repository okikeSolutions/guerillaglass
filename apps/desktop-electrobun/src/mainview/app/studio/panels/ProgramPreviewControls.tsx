import { useEffect, useId, useState, type RefObject } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@guerillaglass/ui/components/button";
import * as m from "../../../../paraglide/messages.js";
import { useStudio, useStudioPlaybackValue } from "../state/StudioProvider";

/** Preview listening and fullscreen never modify the persisted/exported document. */
export function ProgramPreviewControls({
  targetRef,
  available,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
  available: boolean;
}) {
  const studio = useStudio();
  const playing = useStudioPlaybackValue((snapshot) => snapshot.isPlaying);
  const playhead = useStudioPlaybackValue((snapshot) => snapshot.playheadSeconds);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const audioHintId = useId();
  const options = { locale: studio.locale };
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === targetRef.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [targetRef]);
  const toggleFullscreen = async () => {
    setFullscreenFailed(false);
    try {
      const target = targetRef.current;
      if (!target) {
        return;
      }
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        if (typeof target.requestFullscreen !== "function") {
          throw new Error("Fullscreen unsupported");
        }
        await target.requestFullscreen();
      }
    } catch {
      setFullscreenFailed(true);
    }
  };
  return (
    <div className="grid shrink-0 gap-2 px-3 py-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!available}
          onClick={studio.toggleTimelinePlayback}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? m.ui_preview_pause(undefined, options) : m.ui_preview_play(undefined, options)}
        </Button>
        <label className="flex min-w-0 flex-1 items-center text-xs">
          <span className="sr-only">{studio.ui.labels.playhead}</span>
          <input
            type="range"
            min={0}
            max={studio.timelineDuration}
            step={1 / studio.timelineFrameRate}
            aria-label={studio.ui.labels.playhead}
            value={Math.min(playhead, studio.timelineDuration)}
            disabled={!available}
            onPointerDown={() => studio.setTimelinePlaybackActive(false)}
            onKeyDown={(event) => {
              if (
                [
                  "Home",
                  "End",
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "PageUp",
                  "PageDown",
                ].includes(event.key)
              ) {
                studio.setTimelinePlaybackActive(false);
              }
              if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                studio.setPlayheadSeconds(event.key === "Home" ? 0 : studio.timelineDuration);
              }
            }}
            onChange={(event) => studio.setPlayheadSeconds(Number(event.target.value))}
            className="min-w-0 flex-1"
          />
        </label>
        <span className="shrink-0 text-xs tabular-nums">
          {studio.formatDuration(Math.floor(playhead))} /{" "}
          {studio.formatDuration(Math.floor(studio.timelineDuration))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={!available}
          aria-label={
            studio.previewAudio.muted
              ? m.ui_preview_unmute(undefined, options)
              : m.ui_preview_mute(undefined, options)
          }
          aria-pressed={studio.previewAudio.muted}
          onClick={studio.togglePreviewMuted}
        >
          {studio.previewAudio.muted ? (
            <VolumeX aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
        </Button>
        <label
          className="flex items-center gap-2 text-xs"
          title={m.ui_preview_audio_hint(undefined, options)}
        >
          <span>{m.ui_preview_volume(undefined, options)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            aria-label={m.ui_preview_volume(undefined, options)}
            aria-describedby={audioHintId}
            value={studio.previewAudio.volume}
            disabled={!available}
            onChange={(event) => studio.setPreviewVolume(Number(event.target.value))}
            className="w-20"
          />
          <span className="w-8 tabular-nums">{Math.round(studio.previewAudio.volume * 100)}%</span>
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={!available}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          {fullscreen
            ? m.ui_preview_exit_fullscreen(undefined, options)
            : m.ui_preview_fullscreen(undefined, options)}
        </Button>
      </div>
      <p id={audioHintId} className="sr-only">
        {m.ui_preview_audio_hint(undefined, options)}
      </p>
      {fullscreenFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {m.ui_preview_fullscreen_unavailable(undefined, options)}
        </p>
      ) : null}
    </div>
  );
}
