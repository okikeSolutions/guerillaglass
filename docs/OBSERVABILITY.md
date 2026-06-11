# Observability

This document summarizes the desktop observability stack implemented for Guerillaglass. It is based on the installed/vendored Effect v4 APIs:

- `effect@4.0.0-beta.78`
- `@effect/platform-bun@4.0.0-beta.78`
- `effect/unstable/devtools`
- `effect/unstable/observability` researched but not currently wired

## Overview

The desktop Bun host is now Effect/Bun-native at the process edge:

- `BunRuntime.runMain(...)` owns the root process Effect.
- `BunServices.layer` provides Bun-backed platform services such as `FileSystem`, `Path`, `Terminal`, and `Stdio`.
- `Logger` routes console and file logs.
- `Metric` records application and runtime metrics.
- `Effect.withSpan(...)` emits tracing spans for DevTools-compatible consumers.
- `Effect.annotateLogs(...)` and `Effect.withLogSpan(...)` make logs searchable and timed.

## Regions, Sectors, and Areas

| Region | Sector | Area | Implemented signals | Files / APIs |
|---|---|---|---|---|
| Runtime Foundation | Bun / Effect entrypoint | Process root | App runs through `BunRuntime.runMain`; platform services via `BunServices.layer`; runtime/fiber metrics enabled | `apps/desktop-electrobun/src/bun/app/index.ts`; `BunRuntime.runMain`; `BunServices.layer`; `Metric.enableRuntimeMetrics` |
| Logging | Logger routing | Console logs | Dev uses `Logger.consolePretty()`; production uses `Logger.consoleJson` | `apps/desktop-electrobun/src/bun/app/AppLogging.ts`; `Logger.consolePretty`; `Logger.consoleJson` |
| Logging | Logger routing | File logs | JSONL file logging via `Logger.formatJson.pipe(Logger.toFile(...))` | `AppLogging.ts`; `Logger.toFile`; `BunServices.layer` |
| Logging | Log destinations | System log | Primary log path: `~/Library/Logs/Guerillaglass/desktop-electrobun.log` | `apps/desktop-electrobun/src/bun/app/AppLogPaths.ts` |
| Logging | Log destinations | Repo dev log | Dev mirror: `.tmp/desktop-electrobun.log`; disabled in production; override via `GG_DESKTOP_REPO_LOG_PATH`; disable via `GG_DESKTOP_REPO_LOG=0` | `AppLogPaths.ts` |
| Logging | Log level policy | Minimum log level | Dev / diagnostics: `Debug`; production: `Warn` | `AppLogging.ts`; `References.MinimumLogLevel` |
| Logging | Structured context | Annotations | Logs use `Effect.annotateLogs(...)` for fields like `component`, `enginePath`, `bridgeRequest`, `operation` | `index.ts`; `AppLogging.ts`; `launchBun.ts`; `CaptureService.ts`; `requestHandlers.ts` |
| Logging | Local timing | Log spans | Timings shown in logs via `Effect.withLogSpan(...)`, e.g. `engine-launch=148ms`, `project-session-load=14ms` | `index.ts`; `launchBun.ts`; `CaptureService.ts`; `requestHandlers.ts` |
| Tracing | Effect spans | Root/bootstrap spans | Real tracing spans for `desktop-bootstrap`, `desktop-shell-start`, `project-session-load` | `index.ts`; `Effect.withSpan` |
| Tracing | Engine spans | Engine launch | Span: `engine-launch`; attribute: `engine.transport=http` | `packages/engine-client/src/process/launchBun.ts` |
| Tracing | Bridge spans | Renderer ↔ Bun bridge | Span per request: `bridge.<requestName>`; attribute: `bridge.request` | `apps/desktop-electrobun/src/bun/bridge/requestHandlers.ts` |
| Tracing | Capture spans | Capture lifecycle | Spans: `capture.status`, `capture.preview-frame`, `capture.start-display`, etc. | `packages/engine-client/src/services/CaptureService.ts` |
| Metrics | Runtime metrics | Fiber runtime | Automatic Effect runtime metrics: `child_fibers_active`, `child_fibers_started`, `child_fiber_successes`, etc. | `index.ts`; `Metric.enableRuntimeMetrics` |
| Metrics | Desktop lifecycle | Bootstrap duration | `desktop_bootstrap_duration` timer | `apps/desktop-electrobun/src/bun/app/AppMetrics.ts`; `index.ts`; `Effect.trackDuration` |
| Metrics | Desktop process | Memory gauges | `desktop_process_memory_rss_bytes`, `heap_used`, `heap_total`, `external` updated on heartbeat | `AppMetrics.ts`; `AppLogging.ts` |
| Metrics | Bridge | Request counters/durations | `desktop_bridge_requests_total{request}`, `desktop_bridge_request_duration{request}`, `desktop_bridge_request_failures_total{request}` | `AppMetrics.ts`; `requestHandlers.ts` |
| Metrics | Engine | Launch metrics | `engine_launch_duration`, `engine_launch_failures_total` | `packages/engine-client/src/metrics.ts`; `launchBun.ts` |
| Metrics | Capture | Operation counters/durations | `capture_operations_total{operation}`, `capture_operation_duration{operation}`, `capture_operation_failures_total{operation}` | `packages/engine-client/src/metrics.ts`; `CaptureService.ts` |
| Diagnostics | Process diagnostics | Runtime process hooks | Logs `uncaughtExceptionMonitor`, `unhandledRejection`, `warning`, `beforeExit`, `exit` through Effect logger | `AppLogging.ts`; `layerDesktopProcessDiagnostics` |
| Diagnostics | Heartbeat | Process heartbeat | Every 2s logs memory/resource/uptime and updates memory metrics | `AppLogging.ts` |
| DevTools | Optional Effect DevTools | WebSocket client | Gated by `GG_EFFECT_DEVTOOLS=1`; default URL is Effect default `ws://localhost:34437`; override via `GG_EFFECT_DEVTOOLS_URL` | `AppLogging.ts`; `effect/unstable/devtools`; `DevTools.layer(...)` |
| DevTools | Compatibility | VS Code extension | Old extension used Effect 3 / `@effect/experimental`; app uses Effect 4 beta. Keep app DevTools layer optional until a compatible receiver is used | Research result |
| Exporters | Prometheus / OTLP | Not wired yet | Researched available in vendor but not implemented: `PrometheusMetrics`, `OtlpMetrics`, `OtlpLogger`, `OtlpTracer` | `effect/unstable/observability` |

## Log Destinations

Primary system log:

```txt
~/Library/Logs/Guerillaglass/desktop-electrobun.log
```

Development repo mirror:

```txt
.tmp/desktop-electrobun.log
```

Runtime overrides:

```bash
GG_DESKTOP_DIAGNOSTICS_LOG=/tmp/gg.log   # override primary path
GG_DESKTOP_FILE_LOG=0                    # disable file logging
GG_DESKTOP_REPO_LOG=0                    # disable repo mirror
GG_DESKTOP_REPO_LOG_PATH=/tmp/gg-repo.log # override repo mirror path
```

Watch logs:

```bash
tail -F ~/Library/Logs/Guerillaglass/desktop-electrobun.log .tmp/desktop-electrobun.log
```

## Console Logging

Development uses:

```ts
Logger.consolePretty()
```

Production uses:

```ts
Logger.consoleJson
```

Because the dev app is launched through LaunchServices (`open`), console output is only visible when stdout/stderr are explicitly attached, for example:

```bash
open -W -n \
  -o /tmp/gg-effect.stdout.log \
  --stderr /tmp/gg-effect.stderr.log \
  --env GG_ENGINE_PATH="$(cd ../.. && pwd)/.build/debug/guerillaglass-engine" \
  build/dev-macos-arm64/Guerillaglass-dev.app
```

## Structured Logs

Prefer Effect-native annotations for fields:

```ts
Effect.logInfo("engine process ready").pipe(
  Effect.annotateLogs({
    component: "engine-process",
    transport: "http",
    host,
    port,
  }),
);
```

Use log spans for local duration context:

```ts
effect.pipe(
  Effect.withLogSpan("engine-launch"),
);
```

JSON file logs then include:

```json
{
  "message": "engine process ready",
  "annotations": {
    "component": "engine-process",
    "transport": "http"
  },
  "spans": {
    "engine-launch": 148
  }
}
```

## Tracing Spans

Use tracing spans for DevTools / trace receivers:

```ts
effect.pipe(
  Effect.withSpan("desktop-bootstrap", {
    attributes: {
      "desktop.runtime": "bun",
      "desktop.shell": "electrobun"
    }
  })
);
```

Important distinction:

- `Effect.withLogSpan(...)` appears in logs as local timing metadata.
- `Effect.withSpan(...)` emits real tracing spans.
- `Effect.annotateLogs(...)` annotates log entries.
- `Effect.annotateSpans(...)` annotates tracing spans.

## Metrics

Metric definitions live in:

```txt
apps/desktop-electrobun/src/bun/app/AppMetrics.ts
packages/engine-client/src/metrics.ts
```

Current metric families:

```txt
desktop_bootstrap_duration
desktop_bridge_requests_total
desktop_bridge_request_failures_total
desktop_bridge_request_duration
desktop_process_memory_rss_bytes
desktop_process_heap_used_bytes
desktop_process_heap_total_bytes
desktop_process_external_bytes

engine_launch_duration
engine_launch_failures_total

capture_operations_total
capture_operation_failures_total
capture_operation_duration
```

Effect runtime metrics are enabled at the root with:

```ts
Metric.enableRuntimeMetrics
```

This adds fiber runtime metrics such as:

```txt
child_fibers_active
child_fibers_started
child_fiber_successes
child_fiber_failures
```

Keep metric attributes low-cardinality. Good labels:

```txt
request
operation
component
transport
```

Avoid high-cardinality labels:

```txt
file paths
project paths
tokens
raw URLs with dynamic IDs
raw error messages
```

## Optional DevTools

DevTools wiring is optional and off by default:

```bash
GG_EFFECT_DEVTOOLS=1
```

Default endpoint is:

```txt
ws://localhost:34437
```

Override:

```bash
GG_EFFECT_DEVTOOLS_URL=ws://localhost:34438
```

The app uses the Effect v4 API:

```ts
import { DevTools } from "effect/unstable/devtools";
```

The older VS Code extension version that was tested used Effect 3 / `@effect/experimental`, so it did not match the current Effect v4 metric schema. Keep this layer enabled only when using a compatible receiver.

## Researched But Not Wired

Effect v4 also includes OTLP and Prometheus support under:

```ts
import { OtlpLogger, OtlpMetrics, OtlpTracer, PrometheusMetrics } from "effect/unstable/observability";
```

Possible future export routes:

- `PrometheusMetrics.format()` or `PrometheusMetrics.layerHttp(...)` for pull-based metrics.
- `OtlpTracer.layer(...)` for OTLP traces.
- `OtlpLogger.layer(...)` for OTLP logs.
- `OtlpMetrics.layer(...)` for OTLP metrics.

These are not currently wired into desktop runtime.
