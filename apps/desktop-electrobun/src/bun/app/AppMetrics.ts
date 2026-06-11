import { Metric } from "effect";

export const desktopBootstrapDuration = Metric.timer("desktop_bootstrap_duration", {
  description: "Duration of desktop bootstrap operations.",
});

export const desktopBridgeRequestsTotal = Metric.counter("desktop_bridge_requests_total", {
  description: "Total desktop bridge requests handled by the Bun host.",
  incremental: true,
});

export const desktopBridgeRequestFailuresTotal = Metric.counter(
  "desktop_bridge_request_failures_total",
  {
    description: "Total desktop bridge requests that returned an error response.",
    incremental: true,
  },
);

export const desktopBridgeRequestDuration = Metric.timer("desktop_bridge_request_duration", {
  description: "Duration of desktop bridge request handling.",
});

export const desktopProcessMemoryRssBytes = Metric.gauge("desktop_process_memory_rss_bytes", {
  description: "Desktop Bun process resident set size in bytes.",
});

export const desktopProcessHeapUsedBytes = Metric.gauge("desktop_process_heap_used_bytes", {
  description: "Desktop Bun process heap used in bytes.",
});

export const desktopProcessHeapTotalBytes = Metric.gauge("desktop_process_heap_total_bytes", {
  description: "Desktop Bun process heap total in bytes.",
});

export const desktopProcessExternalBytes = Metric.gauge("desktop_process_external_bytes", {
  description: "Desktop Bun process external memory in bytes.",
});
