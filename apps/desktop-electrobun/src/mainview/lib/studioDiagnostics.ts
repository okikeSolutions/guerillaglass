import { useEffect } from "react";
import { Effect, Metric } from "effect";
import { sendHostStudioDiagnostics } from "./engine";
import type { StudioDiagnosticsEntry } from "@shared/bridge/desktopBridgeContract";
import {
  isStudioDiagnosticsEnabledFromSearch,
  type StudioDiagnosticsValue,
} from "@shared/studioDiagnostics";

type DiagnosticsAnnotations = Record<string, StudioDiagnosticsValue>;

type DiagnosticsLogOptions = {
  readonly level: StudioDiagnosticsEntry["level"];
  readonly message: unknown;
  readonly annotations?: DiagnosticsAnnotations | undefined;
  readonly spans?: Record<string, number> | undefined;
  readonly date: Date;
};

type DiagnosticsWindowState = {
  windowStartedAtMs: number;
  playbackTicks: number;
  playbackIntervalTotalMs: number;
  playbackIntervalMaxMs: number;
  lastPlaybackTickAtMs: number | null;
  lastMediaTimeSeconds: number | null;
  playbackActive: boolean;
  activeRoute: string | null;
  renderCounts: Map<string, number>;
};

const playbackTickCounter = Metric.counter("gg_renderer_playback_ticks", {
  description: "Playback sync ticks observed in the renderer.",
  incremental: true,
});
const renderCommitCounter = Metric.counter("gg_renderer_render_commits", {
  description: "Committed React renders observed by diagnostics probes.",
  incremental: true,
});
const playbackTickRateGauge = Metric.gauge("gg_renderer_playback_tick_rate", {
  description: "Playback ticks observed during the last diagnostics window.",
});
const renderCommitRateGauge = Metric.gauge("gg_renderer_render_commit_rate", {
  description: "Committed renders observed during the last diagnostics window.",
});
const playbackIntervalAvgGauge = Metric.gauge("gg_renderer_playback_interval_avg_ms", {
  description: "Average playback sync interval observed in the last diagnostics window.",
});
const playbackIntervalMaxGauge = Metric.gauge("gg_renderer_playback_interval_max_ms", {
  description: "Maximum playback sync interval observed in the last diagnostics window.",
});

let diagnosticsHeartbeatStarted = false;
let diagnosticsHeartbeatHandle: number | null = null;
let diagnosticsState: DiagnosticsWindowState = createWindowState();

function diagnosticsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    isStudioDiagnosticsEnabledFromSearch(window.location.search) ||
    isStudioDiagnosticsEnabledFromSearch(window.location.hash)
  );
}

function createWindowState(): DiagnosticsWindowState {
  return {
    windowStartedAtMs: performance.now(),
    playbackTicks: 0,
    playbackIntervalTotalMs: 0,
    playbackIntervalMaxMs: 0,
    lastPlaybackTickAtMs: null,
    lastMediaTimeSeconds: null,
    playbackActive: false,
    activeRoute: null,
    renderCounts: new Map(),
  };
}

function formatDiagnosticsMessage(message: unknown): string {
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  if (Array.isArray(message)) {
    const rendered = message
      .map((part) => formatDiagnosticsValue(part))
      .filter((part) => part.length > 0)
      .join(" ");
    return rendered.length > 0 ? rendered : "diagnostics";
  }
  const rendered = formatDiagnosticsValue(message);
  return rendered.length > 0 ? rendered : "diagnostics";
}

function formatDiagnosticsValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emitDiagnosticsLog(options: DiagnosticsLogOptions): void {
  const entry: StudioDiagnosticsEntry = {
    source: "renderer",
    level: options.level,
    message: formatDiagnosticsMessage(options.message),
    timestamp: options.date.toISOString(),
  };

  if (options.annotations && Object.keys(options.annotations).length > 0) {
    entry.annotations = options.annotations;
  }

  if (options.spans && Object.keys(options.spans).length > 0) {
    entry.spans = options.spans;
  }

  if (typeof window === "undefined") {
    return;
  }

  if ((window as Window & { ggHostSendStudioDiagnostics?: unknown }).ggHostSendStudioDiagnostics) {
    sendHostStudioDiagnostics(entry);
    return;
  }

  globalThis.console.info("[studio-diagnostics]", entry);
}

function runDiagnosticsEffect(effect: Effect.Effect<void, never, never>): void {
  if (!diagnosticsEnabled()) {
    return;
  }
  Effect.runFork(effect);
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

function flushStudioDiagnosticsWindow(): void {
  if (!diagnosticsEnabled()) {
    return;
  }

  const windowDurationMs = performance.now() - diagnosticsState.windowStartedAtMs;
  const totalRenderCommits = Array.from(diagnosticsState.renderCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
  const averagePlaybackIntervalMs =
    diagnosticsState.playbackTicks > 1
      ? diagnosticsState.playbackIntervalTotalMs / (diagnosticsState.playbackTicks - 1)
      : 0;
  const playbackTickRate =
    windowDurationMs > 0 ? diagnosticsState.playbackTicks / (windowDurationMs / 1000) : 0;
  const renderCommitRate =
    windowDurationMs > 0 ? totalRenderCommits / (windowDurationMs / 1000) : 0;

  const annotations: DiagnosticsAnnotations = {
    route: diagnosticsState.activeRoute,
    playbackActive: diagnosticsState.playbackActive,
    windowDurationMs: roundToHundredths(windowDurationMs),
    playbackTicks: diagnosticsState.playbackTicks,
    playbackTickRate: roundToHundredths(playbackTickRate),
    playbackIntervalAvgMs: roundToHundredths(averagePlaybackIntervalMs),
    playbackIntervalMaxMs: roundToHundredths(diagnosticsState.playbackIntervalMaxMs),
    lastMediaTimeSeconds:
      diagnosticsState.lastMediaTimeSeconds == null
        ? null
        : roundToHundredths(diagnosticsState.lastMediaTimeSeconds),
    totalRenderCommits,
    renderCommitRate: roundToHundredths(renderCommitRate),
  };

  for (const [componentName, count] of diagnosticsState.renderCounts.entries()) {
    annotations[`render.${componentName}`] = count;
  }

  diagnosticsState = {
    ...createWindowState(),
    playbackActive: diagnosticsState.playbackActive,
    activeRoute: diagnosticsState.activeRoute,
  };

  if (totalRenderCommits === 0 && annotations.playbackTicks === 0) {
    return;
  }

  emitDiagnosticsLog({
    level: "Info",
    message: annotations.playbackTicks
      ? "renderer playback diagnostics window"
      : "renderer render diagnostics window",
    annotations,
    spans: { "studioDiagnostics.flush": roundToHundredths(windowDurationMs) },
    date: new Date(),
  });

  runDiagnosticsEffect(
    Effect.gen(function* () {
      yield* Metric.update(playbackTickCounter, annotations.playbackTicks as number);
      yield* Metric.update(renderCommitCounter, totalRenderCommits);
      yield* Metric.update(playbackTickRateGauge, annotations.playbackTickRate as number);
      yield* Metric.update(renderCommitRateGauge, annotations.renderCommitRate as number);
      yield* Metric.update(playbackIntervalAvgGauge, annotations.playbackIntervalAvgMs as number);
      yield* Metric.update(playbackIntervalMaxGauge, annotations.playbackIntervalMaxMs as number);
      yield* Effect.logInfo(
        annotations.playbackTicks
          ? "renderer playback diagnostics window"
          : "renderer render diagnostics window",
      );
    }).pipe(Effect.annotateLogs(annotations), Effect.withLogSpan("studioDiagnostics.flush")),
  );
}

function ensureStudioDiagnosticsSession(): void {
  if (!diagnosticsEnabled() || diagnosticsHeartbeatStarted) {
    return;
  }

  diagnosticsHeartbeatStarted = true;
  diagnosticsHeartbeatHandle = window.setInterval(() => {
    flushStudioDiagnosticsWindow();
  }, 1000);

  emitDiagnosticsLog({
    level: "Info",
    message: "renderer diagnostics enabled",
    annotations: { search: window.location.search },
    spans: { "studioDiagnostics.start": 0 },
    date: new Date(),
  });

  runDiagnosticsEffect(Effect.logInfo("renderer diagnostics enabled"));
}

export function useStudioDiagnosticsSession(): void {
  useEffect(() => {
    ensureStudioDiagnosticsSession();

    return () => {
      if (diagnosticsHeartbeatHandle == null) {
        return;
      }
      window.clearInterval(diagnosticsHeartbeatHandle);
      diagnosticsHeartbeatHandle = null;
      diagnosticsHeartbeatStarted = false;
    };
  }, []);
}

export function useStudioRenderDiagnostics(
  componentName: string,
  annotations?: DiagnosticsAnnotations,
): void {
  useEffect(() => {
    if (!diagnosticsEnabled()) {
      return;
    }

    ensureStudioDiagnosticsSession();
    diagnosticsState.renderCounts.set(
      componentName,
      (diagnosticsState.renderCounts.get(componentName) ?? 0) + 1,
    );
    if (typeof annotations?.route === "string") {
      diagnosticsState.activeRoute = annotations.route;
    }
  }, undefined);
}

export function recordStudioPlaybackActive(isActive: boolean): void {
  if (!diagnosticsEnabled()) {
    return;
  }
  ensureStudioDiagnosticsSession();
  diagnosticsState.playbackActive = isActive;
}

export function recordStudioPlaybackTick(mediaTimeSeconds: number): void {
  if (!diagnosticsEnabled()) {
    return;
  }

  ensureStudioDiagnosticsSession();
  const now = performance.now();
  diagnosticsState.playbackTicks += 1;
  if (diagnosticsState.lastPlaybackTickAtMs != null) {
    const intervalMs = now - diagnosticsState.lastPlaybackTickAtMs;
    diagnosticsState.playbackIntervalTotalMs += intervalMs;
    diagnosticsState.playbackIntervalMaxMs = Math.max(
      diagnosticsState.playbackIntervalMaxMs,
      intervalMs,
    );
  }
  diagnosticsState.lastPlaybackTickAtMs = now;
  diagnosticsState.lastMediaTimeSeconds = mediaTimeSeconds;
}

export function recordStudioDiagnosticsEvent(
  message: string,
  annotations?: DiagnosticsAnnotations,
): void {
  if (!diagnosticsEnabled()) {
    return;
  }

  ensureStudioDiagnosticsSession();
  const effect = annotations
    ? Effect.logDebug(message).pipe(Effect.annotateLogs(annotations))
    : Effect.logDebug(message);
  runDiagnosticsEffect(effect.pipe(Effect.withLogSpan("studioDiagnostics.event")));
}
