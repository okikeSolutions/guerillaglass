import {
  memo,
  useCallback,
  useMemo,
  useRef,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useThrottler } from "@tanstack/react-pacer";
import { AudioLines, Headphones, Lock, Video, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TimelineClip, TimelineLane, TimelineWaveform } from "../model/timelineDomainModel";
import { clampSeconds, pixelsToSeconds } from "../model/timelineDomainModel";
import { studioToggleToneClass, type StudioSemanticState } from "../model/studioSemanticTone";

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

type TimelineSelectedClip = { laneId: "video" | "audio"; clipId: string } | null;

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
  onClearSelection: () => void;
  selectedClip: TimelineSelectedClip;
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
type TrimDragMode = Exclude<DragMode, "playhead">;

type TimelineLanesLayerProps = {
  durationSeconds: number;
  lanes: TimelineLane[];
  laneControls: TimelineLaneControls;
  labels: TimelineSurfaceLabels;
  selectedClip: TimelineSelectedClip;
  selectedMarkerId: string | null;
  onToggleLaneLocked: (laneId: "video" | "audio") => void;
  onToggleLaneMuted: (laneId: "video" | "audio") => void;
  onToggleLaneSolo: (laneId: "video" | "audio") => void;
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

type TimelineOverlayProps = {
  trackOverlayRef: RefObject<HTMLDivElement | null>;
  labels: TimelineSurfaceLabels;
  timelineSnapEnabled: boolean;
  playheadPercent: number;
  trimStartPercent: number;
  trimEndPercent: number;
  trimWidthPercent: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  onSetTrimStartSeconds: (seconds: number) => void;
  onSetTrimEndSeconds: (seconds: number) => void;
  onTrimHandlePointerDown: (mode: TrimDragMode, event: ReactPointerEvent<HTMLElement>) => void;
};

type TrimHandleProps = {
  mode: TrimDragMode;
  percent: number;
  ariaLabel: string;
  seconds: number;
  onChangeSeconds: (seconds: number) => void;
  onPointerDown: (mode: TrimDragMode, event: ReactPointerEvent<HTMLElement>) => void;
};

type LaneControlDefinition = {
  id: keyof TimelineLaneControls["video"];
  Icon: ComponentType;
  toneWhenActive: StudioSemanticState;
  readLabel: (labels: TimelineSurfaceLabels) => string;
};

const laneControlDefinitions: LaneControlDefinition[] = [
  {
    id: "locked",
    Icon: Lock,
    toneWhenActive: "selected",
    readLabel: (labels) => labels.timelineLaneLock,
  },
  {
    id: "muted",
    Icon: VolumeX,
    toneWhenActive: "selectedAlt",
    readLabel: (labels) => labels.timelineLaneMute,
  },
  {
    id: "solo",
    Icon: Headphones,
    toneWhenActive: "selected",
    readLabel: (labels) => labels.timelineLaneSolo,
  },
];

const laneTrackClassById: Record<TimelineLane["id"], string> = {
  video: " gg-timeline-lane-track-video",
  audio: " gg-timeline-lane-track-audio",
  events: " gg-timeline-lane-track-events",
};

function toPercent(seconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  return (clampSeconds(seconds, 0, durationSeconds) / durationSeconds) * 100;
}

function getLaneTrackClass(laneId: TimelineLane["id"], laneControls: TimelineLaneControls): string {
  const baseClass = laneTrackClassById[laneId];
  if (laneId === "video" || laneId === "audio") {
    if (laneControls[laneId].locked) {
      return `${baseClass} gg-timeline-lane-track-locked`;
    }
    if (laneControls[laneId].muted) {
      return `${baseClass} gg-timeline-lane-track-muted`;
    }
  }
  return baseClass;
}

function pickWaveformBars(params: {
  clip: TimelineClip;
  waveform: TimelineWaveform;
  durationSeconds: number;
}): number[] {
  const waveformDuration = Math.max(params.waveform.durationSeconds, 0.001);
  const peaks = params.waveform.peaks;
  if (peaks.length === 0) {
    return [];
  }

  const clipDuration = Math.max(0.001, params.clip.endSeconds - params.clip.startSeconds);
  const clipWidthRatio =
    params.durationSeconds > 0 ? clipDuration / params.durationSeconds : Math.min(1, clipDuration);
  const barCount = Math.min(120, Math.max(14, Math.round(clipWidthRatio * 160)));
  const startRatio = clampSeconds(params.clip.startSeconds / waveformDuration, 0, 1);
  const endRatio = clampSeconds(params.clip.endSeconds / waveformDuration, 0, 1);
  const startIndex = Math.floor(startRatio * peaks.length);
  const endIndex = Math.max(startIndex + 1, Math.ceil(endRatio * peaks.length));
  const span = Math.max(1, endIndex - startIndex);

  return Array.from({ length: barCount }, (_, barIndex) => {
    const chunkStart = startIndex + Math.floor((barIndex * span) / barCount);
    const chunkEnd = Math.max(
      chunkStart + 1,
      startIndex + Math.floor(((barIndex + 1) * span) / barCount),
    );
    let peak = 0;
    for (let index = chunkStart; index < chunkEnd; index += 1) {
      peak = Math.max(peak, peaks[index] ?? 0);
    }
    return Math.min(Math.max(peak, 0.08), 1);
  });
}

function readRulerTicks(durationSeconds: number): {
  id: string;
  isMajor: boolean;
  seconds: number;
  percent: number;
}[] {
  if (durationSeconds <= 0) {
    return [{ id: "tick-0", isMajor: true, seconds: 0, percent: 0 }];
  }
  const totalTicks = 8;
  return Array.from({ length: totalTicks + 1 }, (_, index) => {
    const ratio = index / totalTicks;
    return {
      id: `tick-${index}`,
      isMajor: index % 2 === 0,
      seconds: ratio * durationSeconds,
      percent: ratio * 100,
    };
  });
}

function useTimelineDragController(params: {
  durationSeconds: number;
  trackOverlayRef: RefObject<HTMLDivElement | null>;
  onSetPlayheadSeconds: (seconds: number) => void;
  onSetTrimStartSeconds: (seconds: number) => void;
  onSetTrimEndSeconds: (seconds: number) => void;
  onClearSelection: () => void;
}) {
  const {
    durationSeconds,
    trackOverlayRef,
    onClearSelection,
    onSetPlayheadSeconds,
    onSetTrimStartSeconds,
    onSetTrimEndSeconds,
  } = params;
  const dragModeRef = useRef<DragMode | null>(null);

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const rect = trackOverlayRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return 0;
      }
      return pixelsToSeconds(clientX - rect.left, durationSeconds, rect.width);
    },
    [durationSeconds, trackOverlayRef],
  );

  const applyDragAtClientX = useCallback(
    (clientX: number) => {
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
    },
    [onSetPlayheadSeconds, onSetTrimEndSeconds, onSetTrimStartSeconds, timeFromClientX],
  );

  const pointerDragThrottler = useThrottler(
    (clientX: number) => {
      applyDragAtClientX(clientX);
    },
    {
      leading: true,
      trailing: true,
      wait: 16,
    },
    () => null,
  );

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, mode: DragMode) => {
      if (durationSeconds <= 0) {
        return;
      }
      dragModeRef.current = mode;
      pointerDragThrottler.cancel();
      event.currentTarget.setPointerCapture(event.pointerId);
      applyDragAtClientX(event.clientX);
    },
    [applyDragAtClientX, durationSeconds, pointerDragThrottler],
  );

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.dataset.dragHandle || target.closest("[data-timeline-selectable='true']")) {
        return;
      }
      const trackRect = trackOverlayRef.current?.getBoundingClientRect();
      if (!trackRect || event.clientX < trackRect.left || event.clientX > trackRect.right) {
        return;
      }
      onClearSelection();
      beginDrag(event, "playhead");
    },
    [beginDrag, onClearSelection, trackOverlayRef],
  );

  const onSurfacePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragModeRef.current) {
        return;
      }
      pointerDragThrottler.maybeExecute(event.clientX);
    },
    [pointerDragThrottler],
  );

  const onSurfacePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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
    },
    [pointerDragThrottler],
  );

  const onSurfacePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerDragThrottler.cancel();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragModeRef.current = null;
    },
    [pointerDragThrottler],
  );

  const onTrimHandlePointerDown = useCallback(
    (mode: TrimDragMode, event: ReactPointerEvent<HTMLElement>) => {
      beginDrag(event, mode);
    },
    [beginDrag],
  );

  return {
    onSurfacePointerCancel,
    onSurfacePointerDown,
    onSurfacePointerMove,
    onSurfacePointerUp,
    onTrimHandlePointerDown,
  };
}

function TrimHandle({
  mode,
  percent,
  ariaLabel,
  seconds,
  onChangeSeconds,
  onPointerDown,
}: TrimHandleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={`gg-timeline-trim-handle gg-timeline-trim-handle-${mode === "trimStart" ? "start" : "end"} gg-timeline-entity-button`}
      data-drag-handle={mode === "trimStart" ? "trim-start" : "trim-end"}
      style={{ left: `${percent}%` }}
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={(event) => onPointerDown(mode, event)}
      onKeyDown={(event) => {
        const delta = event.shiftKey ? 1 : 0.1;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChangeSeconds(seconds - delta);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChangeSeconds(seconds + delta);
        }
      }}
    />
  );
}

function TimelineOverlay({
  trackOverlayRef,
  labels,
  timelineSnapEnabled,
  playheadPercent,
  trimStartPercent,
  trimEndPercent,
  trimWidthPercent,
  trimStartSeconds,
  trimEndSeconds,
  onSetTrimStartSeconds,
  onSetTrimEndSeconds,
  onTrimHandlePointerDown,
}: TimelineOverlayProps) {
  return (
    <div ref={trackOverlayRef} className="gg-timeline-track-overlay">
      <div
        className={`gg-timeline-trim-window${timelineSnapEnabled ? " gg-timeline-trim-window-snapping" : ""}`}
        style={{ left: `${trimStartPercent}%`, width: `${trimWidthPercent}%` }}
      />
      <div className="gg-timeline-playhead" style={{ left: `${playheadPercent}%` }} />

      <TrimHandle
        mode="trimStart"
        percent={trimStartPercent}
        ariaLabel={labels.trimInSeconds}
        seconds={trimStartSeconds}
        onChangeSeconds={onSetTrimStartSeconds}
        onPointerDown={onTrimHandlePointerDown}
      />
      <TrimHandle
        mode="trimEnd"
        percent={trimEndPercent}
        ariaLabel={labels.trimOutSeconds}
        seconds={trimEndSeconds}
        onChangeSeconds={onSetTrimEndSeconds}
        onPointerDown={onTrimHandlePointerDown}
      />
    </div>
  );
}

const TimelineLanesLayer = memo(function TimelineLanesLayer({
  durationSeconds,
  lanes,
  laneControls,
  labels,
  selectedClip,
  selectedMarkerId,
  onToggleLaneLocked,
  onToggleLaneMuted,
  onToggleLaneSolo,
  onSelectClip,
  onSelectMarker,
}: TimelineLanesLayerProps) {
  return (
    <div className="gg-timeline-lanes">
      {lanes.map((lane) => (
        <div key={lane.id} className="gg-timeline-lane-row">
          <div className="gg-timeline-lane-label-group">
            <div className="gg-timeline-lane-label">{lane.label}</div>
            {lane.id === "video" || lane.id === "audio" ? (
              <div className="gg-timeline-lane-controls">
                {laneControlDefinitions.map((definition) => {
                  const label = definition.readLabel(labels);
                  const isActive = laneControls[lane.id][definition.id];
                  const tone = isActive ? definition.toneWhenActive : "neutral";
                  const onClick =
                    definition.id === "locked"
                      ? () => onToggleLaneLocked(lane.id)
                      : definition.id === "muted"
                        ? () => onToggleLaneMuted(lane.id)
                        : () => onToggleLaneSolo(lane.id);

                  return (
                    <Tooltip key={`${lane.id}-${definition.id}`}>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className={`gg-timeline-lane-toggle ${studioToggleToneClass(tone)}`}
                            onClick={onClick}
                            title={label}
                            aria-label={label}
                            aria-pressed={isActive}
                          />
                        }
                      >
                        <definition.Icon />
                        <span className="sr-only">{label}</span>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className={`gg-timeline-lane-track${getLaneTrackClass(lane.id, laneControls)}`}>
            {lane.id === "video" || lane.id === "audio"
              ? lane.clips.map((clip) => {
                  const left = toPercent(clip.startSeconds, durationSeconds);
                  const width = toPercent(clip.endSeconds, durationSeconds) - left;
                  const isSelected =
                    selectedClip?.laneId === lane.id && selectedClip?.clipId === clip.id;
                  const laneLocked = laneControls[lane.id].locked;
                  const clipDuration = Math.max(0, clip.endSeconds - clip.startSeconds);
                  const waveformBars =
                    lane.id === "audio" && clip.waveform
                      ? pickWaveformBars({
                          clip,
                          waveform: clip.waveform,
                          durationSeconds,
                        })
                      : [];
                  return (
                    <Button
                      key={clip.id}
                      type="button"
                      variant="ghost"
                      size="sm"
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
                    >
                      <div className="gg-timeline-clip-content">
                        <div className="gg-timeline-clip-header">
                          <span
                            className={`gg-timeline-clip-semantic gg-timeline-clip-semantic-${lane.id}`}
                          >
                            {lane.id === "video" ? <Video /> : <AudioLines />}
                            <span>{lane.label}</span>
                          </span>
                          <span className="gg-timeline-clip-duration gg-numeric">
                            {clipDuration.toFixed(2)}
                          </span>
                        </div>
                        {lane.id === "audio" && waveformBars.length > 0 ? (
                          <div className="gg-timeline-waveform" aria-hidden>
                            {waveformBars.map((bar, index) => (
                              <span
                                key={`${clip.id}-wave-${index}`}
                                className="gg-timeline-waveform-bar"
                                style={{
                                  height: `${Math.round(Math.min(Math.max(bar, 0.08), 1) * 100)}%`,
                                }}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Button>
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
                    <span className={`gg-timeline-marker-line gg-timeline-marker-${marker.kind}`} />
                  </Button>
                ))
              : null}
          </div>
        </div>
      ))}
    </div>
  );
});

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
  onClearSelection,
  selectedClip,
  selectedMarkerId,
  onSelectClip,
  onSelectMarker,
}: TimelineSurfaceProps) {
  const trackOverlayRef = useRef<HTMLDivElement | null>(null);
  const {
    onSurfacePointerCancel,
    onSurfacePointerDown,
    onSurfacePointerMove,
    onSurfacePointerUp,
    onTrimHandlePointerDown,
  } = useTimelineDragController({
    durationSeconds,
    trackOverlayRef,
    onSetPlayheadSeconds,
    onSetTrimStartSeconds,
    onSetTrimEndSeconds,
    onClearSelection,
  });

  const effectiveTrimEnd = trimEndSeconds > 0 ? trimEndSeconds : durationSeconds;
  const clampedTrimStart = clampSeconds(trimStartSeconds, 0, durationSeconds);
  const clampedTrimEnd = clampSeconds(effectiveTrimEnd, clampedTrimStart, durationSeconds);

  const playheadPercent = toPercent(playheadSeconds, durationSeconds);
  const trimStartPercent = toPercent(clampedTrimStart, durationSeconds);
  const trimEndPercent = toPercent(clampedTrimEnd, durationSeconds);
  const trimWidthPercent = Math.max(0, trimEndPercent - trimStartPercent);

  const rulerTicks = useMemo(() => readRulerTicks(durationSeconds), [durationSeconds]);

  return (
    <div className="gg-timeline-wrapper">
      <div className="gg-timeline-ruler" aria-hidden>
        {rulerTicks.map((tick) => (
          <div
            key={tick.id}
            className={`gg-timeline-ruler-tick${
              tick.isMajor ? " gg-timeline-ruler-tick-major" : " gg-timeline-ruler-tick-minor"
            }`}
            style={{ left: `${tick.percent}%` }}
          >
            <span>{tick.seconds.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="gg-timeline-scroll">
        <div
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
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClearSelection();
            }
          }}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={onSurfacePointerCancel}
        >
          <TimelineLanesLayer
            durationSeconds={durationSeconds}
            lanes={lanes}
            laneControls={laneControls}
            labels={labels}
            selectedClip={selectedClip}
            selectedMarkerId={selectedMarkerId}
            onToggleLaneLocked={onToggleLaneLocked}
            onToggleLaneMuted={onToggleLaneMuted}
            onToggleLaneSolo={onToggleLaneSolo}
            onSelectClip={onSelectClip}
            onSelectMarker={onSelectMarker}
          />
          <TimelineOverlay
            trackOverlayRef={trackOverlayRef}
            labels={labels}
            timelineSnapEnabled={timelineSnapEnabled}
            playheadPercent={playheadPercent}
            trimStartPercent={trimStartPercent}
            trimEndPercent={trimEndPercent}
            trimWidthPercent={trimWidthPercent}
            trimStartSeconds={trimStartSeconds}
            trimEndSeconds={trimEndSeconds}
            onSetTrimStartSeconds={onSetTrimStartSeconds}
            onSetTrimEndSeconds={onSetTrimEndSeconds}
            onTrimHandlePointerDown={onTrimHandlePointerDown}
          />
        </div>
      </div>
    </div>
  );
}
