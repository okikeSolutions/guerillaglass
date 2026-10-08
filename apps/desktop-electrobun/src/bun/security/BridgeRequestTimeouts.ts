import { Schema, type Duration } from "effect";
import { bridgeDefinitionsByName } from "../../shared/bridge/desktopBridgeContract";
import type { BridgeRequestName } from "../../shared/bridge/desktopBridgeContract";

const defaultBridgeRequestTimeout = "30 seconds";

const bridgeRequestTimeouts: Partial<Record<BridgeRequestName, Duration.Input & string>> = {
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
export function bridgeRequestTimeoutFor(
  name: BridgeRequestName,
  params?: unknown,
): Duration.Input & string {
  if (
    name === "ggEngineStartWindowCapture" &&
    Schema.is(bridgeDefinitionsByName.ggEngineStartWindowCapture.paramsSchema)(params) &&
    params.windowId === 0
  ) {
    // The native picker owns a ten-minute selection deadline; allow capture startup afterward.
    return "11 minutes";
  }
  return bridgeRequestTimeouts[name] ?? defaultBridgeRequestTimeout;
}
