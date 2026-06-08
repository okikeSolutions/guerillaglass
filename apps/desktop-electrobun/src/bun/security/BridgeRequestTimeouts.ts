import type { BridgeRequestName } from "../../shared/bridge/desktopBridgeContract";

const defaultBridgeRequestTimeout = "30 seconds";

const bridgeRequestTimeouts: Partial<Record<BridgeRequestName, string>> = {
  ggEngineAgentRun: "10 minutes",
  ggEngineAgentApply: "5 minutes",
  ggEngineRunExport: "30 minutes",
  ggEngineRunCutPlanExport: "30 minutes",
  ggEngineStartRecording: "20 seconds",
  ggEngineStopRecording: "60 seconds",
  ggEngineStartDisplayCapture: "20 seconds",
  ggEngineStartCurrentWindowCapture: "20 seconds",
  ggEngineStartWindowCapture: "20 seconds",
  ggEngineStopCapture: "60 seconds",
  ggPickPath: "10 minutes",
};

/** Returns the operation-level timeout used for a renderer bridge request. */
export function bridgeRequestTimeoutFor(name: BridgeRequestName): string {
  return bridgeRequestTimeouts[name] ?? defaultBridgeRequestTimeout;
}
