import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { TimelineLane } from "../studio/timelineModel";
import { clampSeconds, pixelsToSeconds } from "../studio/timelineModel";

type TimelineSurfaceLabels = {
  playhead: string;
  trimInSeconds: string;
  trimOutSeconds: string;
};

type TimelineSurfaceProps = {
  durationSeconds: number;
  playheadSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  lanes: TimelineLane[];
  labels: TimelineSurfaceLabels;
  onSetPlayheadSeconds: (seconds: number) => void;
  onSetTrimStartSeconds: (seconds: number) => void;
  onSetTrimEndSeconds: (seconds: number) => void;
  onNudgePlayheadSeconds: (deltaSeconds: number) => void;
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
  lanes,
  labels,
  onSetPlayheadSeconds,
  onSetTrimStartSeconds,
  onSetTrimEndSeconds,
  onNudgePlayheadSeconds,
}: TimelineSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);

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

  const timeFromPointerEvent = (event: ReactPointerEvent<HTMLDivElement>): number => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    return pixelsToSeconds(event.clientX - rect.left, durationSeconds, rect.width);
  };

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const nextTime = timeFromPointerEvent(event);
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

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, mode: DragMode) => {
    if (durationSeconds <= 0) {
      return;
    }
    dragModeRef.current = mode;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
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

      <div
        ref={surfaceRef}
        className="gg-timeline-surface"
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
          if ((event.target as HTMLElement).dataset.dragHandle) {
            return;
          }
          beginDrag(event, "playhead");
        }}
        onPointerMove={(event) => {
          if (!dragModeRef.current) {
            return;
          }
          updateFromPointer(event);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="gg-timeline-trim-window"
          style={{ left: `${trimStartPercent}%`, width: `${trimWidthPercent}%` }}
        />
        <div className="gg-timeline-playhead" style={{ left: `${playheadPercent}%` }} />

        <div
          className="gg-timeline-trim-handle gg-timeline-trim-handle-start"
          data-drag-handle="trim-start"
          style={{ left: `${trimStartPercent}%` }}
          aria-label={labels.trimInSeconds}
          title={labels.trimInSeconds}
          onPointerDown={(event) => beginDrag(event, "trimStart")}
        />
        <div
          className="gg-timeline-trim-handle gg-timeline-trim-handle-end"
          data-drag-handle="trim-end"
          style={{ left: `${trimEndPercent}%` }}
          aria-label={labels.trimOutSeconds}
          title={labels.trimOutSeconds}
          onPointerDown={(event) => beginDrag(event, "trimEnd")}
        />

        <div className="gg-timeline-lanes" aria-hidden>
          {lanes.map((lane) => (
            <div key={lane.id} className="gg-timeline-lane-row">
              <div className="gg-timeline-lane-label">{lane.label}</div>
              <div className="gg-timeline-lane-track">
                {"clips" in lane
                  ? lane.clips.map((clip) => {
                      const left = toPercent(clip.startSeconds, durationSeconds);
                      const width = toPercent(clip.endSeconds, durationSeconds) - left;
                      return (
                        <div
                          key={clip.id}
                          className={`gg-timeline-clip gg-timeline-clip-${lane.id}`}
                          style={{ left: `${left}%`, width: `${Math.max(width, 0)}%` }}
                        />
                      );
                    })
                  : null}

                {"markers" in lane
                  ? lane.markers.map((marker) => (
                      <div
                        key={marker.id}
                        className={`gg-timeline-marker gg-timeline-marker-${marker.kind}`}
                        style={{
                          left: `${toPercent(marker.timestampSeconds, durationSeconds)}%`,
                          height: `${Math.min(22, 8 + marker.density)}px`,
                        }}
                      />
                    ))
                  : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
