import { Schema } from "effect";
import { SerializedBridgeError } from "../errors/desktopErrors";
import type {
  BunBridgeRequestHandlerMap,
  BridgeRequestName,
  BridgeRequestHandlerMap,
  BridgeRequestInvoker,
  BridgeRequests,
  BridgeResponseEnvelope,
  BridgeRequestArguments,
  HostMenuState,
  StudioDiagnosticsEntry,
  WindowBridgeBindings,
} from "./desktopBridgeContract";
import {
  decodeUnknownWithSchemaSync,
  encodeUnknownWithSchemaSync,
} from "@guerillaglass/engine-client/schemaContracts";
import { deserializeBridgeError, serializeBridgeError } from "../errors/desktopErrorSerialization";
import { bridgeDefinitionsByName } from "./desktopBridgeContract";

/** Creates renderer bindings that validate responses and rehydrate typed host errors. */
export function createWindowBridgeBindings(
  invoke: BridgeRequestInvoker,
  sendHostMenuState: (state: HostMenuState) => void,
  sendStudioDiagnostics: (entry: StudioDiagnosticsEntry) => void,
): WindowBridgeBindings {
  function createBinding<K extends BridgeRequestName>(name: K) {
    const definition = bridgeDefinitionsByName[name];
    return async (...args: BridgeRequestArguments[K]): Promise<BridgeRequests[K]["response"]> => {
      const response = decodeUnknownWithSchemaSync(
        Schema.Union([
          Schema.Struct({ ok: Schema.Literal(true), data: definition.responseSchema }),
          Schema.Struct({ ok: Schema.Literal(false), error: SerializedBridgeError }),
        ]),
        await invoke(name, definition.toParams(...args)),
        `${name} bridge response`,
      );
      if (!response.ok) {
        throw deserializeBridgeError(response.error);
      }
      return response.data;
    };
  }
  return {
    ggEnginePing: createBinding("ggEnginePing"),
    ggEngineCapabilities: createBinding("ggEngineCapabilities"),
    ggEngineGetPermissions: createBinding("ggEngineGetPermissions"),
    ggEngineAgentPreflight: createBinding("ggEngineAgentPreflight"),
    ggEngineAgentRun: createBinding("ggEngineAgentRun"),
    ggEngineAgentStatus: createBinding("ggEngineAgentStatus"),
    ggEngineAgentApply: createBinding("ggEngineAgentApply"),
    ggEngineRequestScreenRecordingPermission: createBinding(
      "ggEngineRequestScreenRecordingPermission",
    ),
    ggEngineRequestMicrophonePermission: createBinding("ggEngineRequestMicrophonePermission"),
    ggEngineRequestInputMonitoringPermission: createBinding(
      "ggEngineRequestInputMonitoringPermission",
    ),
    ggEngineOpenInputMonitoringSettings: createBinding("ggEngineOpenInputMonitoringSettings"),
    ggEngineListSources: createBinding("ggEngineListSources"),
    ggEngineStartDisplayCapture: createBinding("ggEngineStartDisplayCapture"),
    ggEngineStartCurrentWindowCapture: createBinding("ggEngineStartCurrentWindowCapture"),
    ggEngineStartWindowCapture: createBinding("ggEngineStartWindowCapture"),
    ggEngineStopCapture: createBinding("ggEngineStopCapture"),
    ggEngineStartRecording: createBinding("ggEngineStartRecording"),
    ggEngineStopRecording: createBinding("ggEngineStopRecording"),
    ggEngineCaptureStatus: createBinding("ggEngineCaptureStatus"),
    ggEngineCapturePreviewFrame: createBinding("ggEngineCapturePreviewFrame"),
    ggEngineExportInfo: createBinding("ggEngineExportInfo"),
    ggEngineRunExport: createBinding("ggEngineRunExport"),
    ggEngineRunCutPlanExport: createBinding("ggEngineRunCutPlanExport"),
    ggEngineProjectCurrent: createBinding("ggEngineProjectCurrent"),
    ggEngineProjectOpen: createBinding("ggEngineProjectOpen"),
    ggEngineProjectSave: createBinding("ggEngineProjectSave"),
    ggEngineProjectRecents: createBinding("ggEngineProjectRecents"),
    ggReviewSessionSnapshot: createBinding("ggReviewSessionSnapshot"),
    ggGrantReviewMutationCapability: createBinding("ggGrantReviewMutationCapability"),
    ggReviewCreateComment: createBinding("ggReviewCreateComment"),
    ggReviewSetWorkflowStatus: createBinding("ggReviewSetWorkflowStatus"),
    ggPickPath: createBinding("ggPickPath"),
    ggReadTextFile: createBinding("ggReadTextFile"),
    ggGrantMediaSourceCapability: createBinding("ggGrantMediaSourceCapability"),
    ggResolveMediaSourceURL: createBinding("ggResolveMediaSourceURL"),
    ggGrantCapturePreviewCapability: createBinding("ggGrantCapturePreviewCapability"),
    ggResolveCapturePreviewURL: createBinding("ggResolveCapturePreviewURL"),
    ggHostSendMenuState: sendHostMenuState,
    ggHostSendStudioDiagnostics: sendStudioDiagnostics,
  };
}

/** Validates host ingress and wraps handlers in a typed success/error transport envelope. */
export function createBunBridgeHandlers(
  handlers: BridgeRequestHandlerMap,
): BunBridgeRequestHandlerMap {
  function wrap<K extends BridgeRequestName>(name: K) {
    const definition = bridgeDefinitionsByName[name];
    return async (
      params: BridgeRequests[K]["params"],
    ): Promise<BridgeResponseEnvelope<BridgeRequests[K]["response"]>> => {
      try {
        const input = decodeUnknownWithSchemaSync(
          definition.paramsSchema,
          params,
          `${name} bridge params`,
        );
        const data = await handlers[name](input);
        const encoded = encodeUnknownWithSchemaSync(
          definition.responseSchema,
          data,
          `${name} bridge response`,
        );
        return {
          ok: true,
          data: decodeUnknownWithSchemaSync(
            definition.responseSchema,
            encoded,
            `${name} bridge response`,
          ),
        };
      } catch (error) {
        return { ok: false, error: serializeBridgeError(error) };
      }
    };
  }
  return {
    ggEnginePing: wrap("ggEnginePing"),
    ggEngineCapabilities: wrap("ggEngineCapabilities"),
    ggEngineGetPermissions: wrap("ggEngineGetPermissions"),
    ggEngineAgentPreflight: wrap("ggEngineAgentPreflight"),
    ggEngineAgentRun: wrap("ggEngineAgentRun"),
    ggEngineAgentStatus: wrap("ggEngineAgentStatus"),
    ggEngineAgentApply: wrap("ggEngineAgentApply"),
    ggEngineRequestScreenRecordingPermission: wrap("ggEngineRequestScreenRecordingPermission"),
    ggEngineRequestMicrophonePermission: wrap("ggEngineRequestMicrophonePermission"),
    ggEngineRequestInputMonitoringPermission: wrap("ggEngineRequestInputMonitoringPermission"),
    ggEngineOpenInputMonitoringSettings: wrap("ggEngineOpenInputMonitoringSettings"),
    ggEngineListSources: wrap("ggEngineListSources"),
    ggEngineStartDisplayCapture: wrap("ggEngineStartDisplayCapture"),
    ggEngineStartCurrentWindowCapture: wrap("ggEngineStartCurrentWindowCapture"),
    ggEngineStartWindowCapture: wrap("ggEngineStartWindowCapture"),
    ggEngineStopCapture: wrap("ggEngineStopCapture"),
    ggEngineStartRecording: wrap("ggEngineStartRecording"),
    ggEngineStopRecording: wrap("ggEngineStopRecording"),
    ggEngineCaptureStatus: wrap("ggEngineCaptureStatus"),
    ggEngineCapturePreviewFrame: wrap("ggEngineCapturePreviewFrame"),
    ggEngineExportInfo: wrap("ggEngineExportInfo"),
    ggEngineRunExport: wrap("ggEngineRunExport"),
    ggEngineRunCutPlanExport: wrap("ggEngineRunCutPlanExport"),
    ggEngineProjectCurrent: wrap("ggEngineProjectCurrent"),
    ggEngineProjectOpen: wrap("ggEngineProjectOpen"),
    ggEngineProjectSave: wrap("ggEngineProjectSave"),
    ggEngineProjectRecents: wrap("ggEngineProjectRecents"),
    ggReviewSessionSnapshot: wrap("ggReviewSessionSnapshot"),
    ggGrantReviewMutationCapability: wrap("ggGrantReviewMutationCapability"),
    ggReviewCreateComment: wrap("ggReviewCreateComment"),
    ggReviewSetWorkflowStatus: wrap("ggReviewSetWorkflowStatus"),
    ggPickPath: wrap("ggPickPath"),
    ggReadTextFile: wrap("ggReadTextFile"),
    ggGrantMediaSourceCapability: wrap("ggGrantMediaSourceCapability"),
    ggResolveMediaSourceURL: wrap("ggResolveMediaSourceURL"),
    ggGrantCapturePreviewCapability: wrap("ggGrantCapturePreviewCapability"),
    ggResolveCapturePreviewURL: wrap("ggResolveCapturePreviewURL"),
  };
}
