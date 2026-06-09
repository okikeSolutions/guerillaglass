import { Metric } from "effect";

export const engineLaunchDuration = Metric.timer("engine_launch_duration", {
  description: "Duration of native engine process launch and readiness.",
});

export const engineLaunchFailuresTotal = Metric.counter("engine_launch_failures_total", {
  description: "Total native engine launch failures.",
  incremental: true,
});

export const captureOperationsTotal = Metric.counter("capture_operations_total", {
  description: "Total capture domain operations invoked through the engine client.",
  incremental: true,
});

export const captureOperationFailuresTotal = Metric.counter("capture_operation_failures_total", {
  description: "Total capture domain operations that failed through the engine client.",
  incremental: true,
});

export const captureOperationDuration = Metric.timer("capture_operation_duration", {
  description: "Duration of capture domain operations through the engine client.",
});
