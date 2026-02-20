import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useThrottler } from "@tanstack/react-pacer";
import { Headphones, Lock, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineLane } from "../studio/timelineModel";
import { clampSeconds, pixelsToSeconds } from "../studio/timelineModel";

type TimelineSurfaceLabels = {
  playhead: string;
  trimInSeconds: string;
  trimOutSeconds: string;
  timelineTools: string;
  timelineSnap: string;
  timelineRipple: string;
  timelineZoom: string;
  timelineLaneLock: string;
  timelineLaneMute: string;
  timelineLaneSolo: string;
  timelineMarkerMove: string;
  timelineMarkerClick: string;
  timelineMarkerMixed: string;
  timelineClipAria: (laneLabel: string, startSeconds: number, endSeconds: number) => string;
  timelineMarkerAria: (markerKindLabel: string, timestampSeconds: number) => string;
};

type TimelineLaneControls = Record<
  "video" | "audio",
  {
    locked: boolean;
    muted: boolean;
    solo: boolean;
  }
>;

type TimelineSurfaceProps = {
  durationSeconds: number;
  playheadSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  zoomPercent: number;
  timelineTool: "select" | "trim" | "blade";
  timelineSnapEnabled: boolean;
  lanes: TimelineLane[];
  laneControls: TimelineLaneControls;
  labels: TimelineSurfaceLabels;
  onSetPlayheadSeconds: (seconds: number) => void;
  onSetTrimStartSeconds: (seconds: number) => void;
  onSetTrimEndSeconds: (seconds: number) => void;
  onNudgePlayheadSeconds: (deltaSeconds: number) => void;
  onToggleLaneLocked: (laneId: "video" | "audio") => void;
  onToggleLaneMuted: (laneId: "video" | "audio") => void;
  onToggleLaneSolo: (laneId: "video" | "audio") => void;
  selectedClip: { laneId: "video" | "audio"; clipId: string } | null;
  selectedMarkerId: string | null;
  onSelectClip: (params: {
    laneId: "video" | "audio";
    clipId: string;
    startSeconds: number;
    endSeconds: number;
  }) => void;
  onSelectMarker: (params: {
    markerId: string;
    markerKind: "move" | "click" | "mixed";
    density: number;
    timestampSeconds: number;
  }) => void;
};

type DragMode = "playhead" | "trimStart" | "trimEnd";

function toPercent(seconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  return (clampSeconds(seconds, 0, durationSeconds) / durationSeconds) * 100;
}

export function TimelineSurface({
  durationSeconds,
  playheadSeconds,
  trimStartSeconds,
  trimEndSeconds,
  zoomPercent,
  timelineTool,
  timelineSnapEnabled,
  lanes,
  laneControls,
  labels,
  onSetPlayheadSeconds,
  onSetTrimStartSeconds,
  onSetTrimEndSeconds,
  onNudgePlayheadSeconds,
  onToggleLaneLocked,
  onToggleLaneMuted,
  onToggleLaneSolo,
  selectedClip,
  selectedMarkerId,
  onSelectClip,
  onSelectMarker,
}: TimelineSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const pointerDragThrottleMs = 16;

  const effectiveTrimEnd = trimEndSeconds > 0 ? trimEndSeconds : durationSeconds;
  const clampedTrimStart = clampSeconds(trimStartSeconds, 0, durationSeconds);
  const clampedTrimEnd = clampSeconds(effectiveTrimEnd, clampedTrimStart, durationSeconds);

  const playheadPercent = toPercent(playheadSeconds, durationSeconds);
  const trimStartPercent = toPercent(clampedTrimStart, durationSeconds);
  const trimEndPercent = toPercent(clampedTrimEnd, durationSeconds);
  const trimWidthPercent = Math.max(0, trimEndPercent - trimStartPercent);

  const rulerTicks = useMemo(() => {
    if (durationSeconds <= 0) {
      return [{ id: "tick-0", seconds: 0, percent: 0 }];
    }
    const totalTicks = 8;
    return Array.from({ length: totalTicks + 1 }, (_, index) => {
      const ratio = index / totalTicks;
      const seconds = ratio * durationSeconds;
      return {
        id: `tick-${index}`,
        seconds,
        percent: ratio * 100,
      };
    });
  }, [durationSeconds]);

  const timeFromClientX = (clientX: number): number => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    return pixelsToSeconds(clientX - rect.left, durationSeconds, rect.width);
  };

  const updateFromPointerClientX = (clientX: number) => {
    const nextTime = timeFromClientX(clientX);
    switch (dragModeRef.current) {
      case "trimStart":
        onSetTrimStartSeconds(nextTime);
        break;
      case "trimEnd":
        onSetTrimEndSeconds(nextTime);
        break;
      case "playhead":
        onSetPlayheadSeconds(nextTime);
        break;
      default:
        break;
    }
  };

  const pointerDragThrottler = useThrottler(
    (clientX: number) => {
      updateFromPointerClientX(clientX);
    },
    {
      leading: true,
      trailing: true,
      wait: pointerDragThrottleMs,
    },
    () => null,
  );

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, mode: DragMode) => {
    if (durationSeconds <= 0) {
      return;
    }
    dragModeRef.current = mode;
    pointerDragThrottler.cancel();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointerClientX(event.clientX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragModeRef.current) {
      return;
    }

    pointerDragThrottler.maybeExecute(event.clientX);
    pointerDragThrottler.flush();
    pointerDragThrottler.cancel();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragModeRef.current = null;
  };

  const cancelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerDragThrottler.cancel();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragModeRef.current = null;
  };

  return (
    <div className="gg-timeline-wrapper">
      <div className="gg-timeline-ruler" aria-hidden>
        {rulerTicks.map((tick) => (
          <div
            key={tick.id}
            className="gg-timeline-ruler-tick"
            style={{ left: `${tick.percent}%` }}
          >
            <span>{tick.seconds.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="gg-timeline-scroll">
        <div
          ref={surfaceRef}
          className={`gg-timeline-surface gg-timeline-tool-${timelineTool}`}
          style={{ minWidth: `${Math.max(100, zoomPercent)}%` }}
          tabIndex={0}
          role="group"
          aria-label={labels.playhead}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onNudgePlayheadSeconds(event.shiftKey ? -1 : -0.1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              onNudgePlayheadSeconds(event.shiftKey ? 1 : 0.1);
            }
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (target.dataset.dragHandle || target.closest("[data-timeline-selectable='true']")) {
              return;
            }
            beginDrag(event, "playhead");
          }}
          onPointerMove={(event) => {
            if (!dragModeRef.current) {
              return;
            }
            pointerDragThrottler.maybeExecute(event.clientX);
          }}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
        >
          <div
            className={`gg-timeline-trim-window${timelineSnapEnabled ? " gg-timeline-trim-window-snapping" : ""}`}
            style={{ left: `${trimStartPercent}%`, width: `${trimWidthPercent}%` }}
          />
          <div className="gg-timeline-playhead" style={{ left: `${playheadPercent}%` }} />

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="gg-timeline-trim-handle gg-timeline-trim-handle-start gg-timeline-entity-button"
            data-drag-handle="trim-start"
            style={{ left: `${trimStartPercent}%` }}
            aria-label={labels.trimInSeconds}
            title={labels.trimInSeconds}
            onPointerDown={(event) => beginDrag(event, "trimStart")}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 1 : 0.1;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                onSetTrimStartSeconds(trimStartSeconds - delta);
                return;
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                onSetTrimStartSeconds(trimStartSeconds + delta);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="gg-timeline-trim-handle gg-timeline-trim-handle-end gg-timeline-entity-button"
            data-drag-handle="trim-end"
            style={{ left: `${trimEndPercent}%` }}
            aria-label={labels.trimOutSeconds}
            title={labels.trimOutSeconds}
            onPointerDown={(event) => beginDrag(event, "trimEnd")}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 1 : 0.1;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                onSetTrimEndSeconds(trimEndSeconds - delta);
                return;
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                onSetTrimEndSeconds(trimEndSeconds + delta);
              }
            }}
          />

          <div className="gg-timeline-lanes">
            {lanes.map((lane) => (
              <div key={lane.id} className="gg-timeline-lane-row">
                <div className="gg-timeline-lane-label-group">
                  <div className="gg-timeline-lane-label">{lane.label}</div>
                  {lane.id === "video" || lane.id === "audio" ? (
                    <div className="gg-timeline-lane-controls">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className={`gg-timeline-lane-toggle${laneControls[lane.id].locked ? " gg-timeline-lane-toggle-active" : ""}`}
                        onClick={() => onToggleLaneLocked(lane.id)}
                        title={labels.timelineLaneLock}
                        aria-label={labels.timelineLaneLock}
                        aria-pressed={laneControls[lane.id].locked}
                      >
                        <Lock />
                        <span className="sr-only">{labels.timelineLaneLock}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className={`gg-timeline-lane-toggle${laneControls[lane.id].muted ? " gg-timeline-lane-toggle-active" : ""}`}
                        onClick={() => onToggleLaneMuted(lane.id)}
                        title={labels.timelineLaneMute}
                        aria-label={labels.timelineLaneMute}
                        aria-pressed={laneControls[lane.id].muted}
                      >
                        <VolumeX />
                        <span className="sr-only">{labels.timelineLaneMute}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className={`gg-timeline-lane-toggle${laneControls[lane.id].solo ? " gg-timeline-lane-toggle-active" : ""}`}
                        onClick={() => onToggleLaneSolo(lane.id)}
                        title={labels.timelineLaneSolo}
                        aria-label={labels.timelineLaneSolo}
                        aria-pressed={laneControls[lane.id].solo}
                      >
                        <Headphones />
                        <span className="sr-only">{labels.timelineLaneSolo}</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div
                  className={`gg-timeline-lane-track${
                    lane.id === "video" || lane.id === "audio"
                      ? laneControls[lane.id].locked
                        ? " gg-timeline-lane-track-locked"
                        : laneControls[lane.id].muted
                          ? " gg-timeline-lane-track-muted"
                          : ""
                      : ""
                  }`}
                >
                  {lane.id === "video" || lane.id === "audio"
                    ? lane.clips.map((clip) => {
                        const left = toPercent(clip.startSeconds, durationSeconds);
                        const width = toPercent(clip.endSeconds, durationSeconds) - left;
                        const isSelected =
                          selectedClip?.laneId === lane.id && selectedClip?.clipId === clip.id;
                        const laneLocked = laneControls[lane.id].locked;
                        return (
                          <Button
                            key={clip.id}
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            data-timeline-selectable="true"
                            className={`gg-timeline-clip gg-timeline-entity-button gg-timeline-clip-${lane.id}${isSelected ? " gg-timeline-clip-selected" : ""}`}
                            style={{ left: `${left}%`, width: `${Math.max(width, 0)}%` }}
                            aria-label={labels.timelineClipAria(
                              lane.label,
                              clip.startSeconds,
                              clip.endSeconds,
                            )}
                            aria-pressed={isSelected}
                            disabled={laneLocked}
                            onClick={() =>
                              onSelectClip({
                                laneId: lane.id,
                                clipId: clip.id,
                                startSeconds: clip.startSeconds,
                                endSeconds: clip.endSeconds,
                              })
                            }
                          />
                        );
                      })
                    : null}

                  {"markers" in lane
                    ? lane.markers.map((marker) => (
                        <Button
                          key={marker.id}
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          data-timeline-selectable="true"
                          className={`gg-timeline-marker-hit gg-timeline-entity-button${selectedMarkerId === marker.id ? " gg-timeline-marker-selected" : ""}`}
                          style={{
                            left: `${toPercent(marker.timestampSeconds, durationSeconds)}%`,
                            height: `${Math.min(22, 8 + marker.density)}px`,
                          }}
                          aria-label={labels.timelineMarkerAria(
                            marker.kind === "click"
                              ? labels.timelineMarkerClick
                              : marker.kind === "mixed"
                                ? labels.timelineMarkerMixed
                                : labels.timelineMarkerMove,
                            marker.timestampSeconds,
                          )}
                          aria-pressed={selectedMarkerId === marker.id}
                          onClick={() =>
                            onSelectMarker({
                              markerId: marker.id,
                              markerKind: marker.kind,
                              density: marker.density,
                              timestampSeconds: marker.timestampSeconds,
                            })
                          }
                        >
                          <span
                            className={`gg-timeline-marker-line gg-timeline-marker-${marker.kind}`}
                          />
                        </Button>
                      ))
                    : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
