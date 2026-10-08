import { Effect, Metric, Schema } from "effect";
import { bridgeDefinitionsByName } from "../../shared/bridge/desktopBridgeContract";
import { createBunBridgeHandlers } from "../../shared/bridge/desktopBridgeBindings";
import type {
  BunBridgeRequestHandlerMap,
  BridgeRequestName,
  BridgeResponseEnvelope,
  BridgeRequests,
} from "../../shared/bridge/desktopBridgeContract";
import type { DesktopAppRuntime } from "../app/AppRuntime";
import type { DesktopAppServices } from "../app/AppLayer";
import {
  desktopBridgeRequestDuration,
  desktopBridgeRequestFailuresTotal,
  desktopBridgeRequestsTotal,
} from "../app/AppMetrics";
import { redactBridgeErrorForRendererEffect } from "../security/BridgeErrorRedaction";
import { HostBridgeService } from "./HostBridgeService";

type BridgeHandlerDependencies = {
  runtime: DesktopAppRuntime;
};

/** Creates bridge RPC handlers that only route requests into HostBridgeService. */
export function createEngineBridgeHandlers({
  runtime,
}: BridgeHandlerDependencies): BunBridgeRequestHandlerMap {
  const run = <A, E>(effect: Effect.Effect<A, E, DesktopAppServices>): Promise<A> =>
    runtime.runPromise(effect);
  function createHandler<K extends BridgeRequestName>(name: K) {
    return (params: BridgeRequests[K]["params"]) =>
      run(
        Effect.gen(function* () {
          const bridge = yield* HostBridgeService;
          const result = yield* bridge.handle(name, params);
          return yield* Schema.decodeUnknownEffect(bridgeDefinitionsByName[name].responseSchema)(
            result,
          );
        }).pipe(
          Effect.ensuring(
            Metric.update(Metric.withAttributes(desktopBridgeRequestsTotal, { request: name }), 1),
          ),
          Effect.trackDuration(
            Metric.withAttributes(desktopBridgeRequestDuration, { request: name }),
          ),
          Effect.annotateLogs({ bridgeRequest: name, component: "desktop-bridge" }),
          Effect.withLogSpan("bridge-request"),
          Effect.withSpan(`bridge.${name}`, { attributes: { "bridge.request": name } }),
        ),
      );
  }
  const handlers = createBunBridgeHandlers({
    ggEnginePing: createHandler("ggEnginePing"),
    ggEngineCapabilities: createHandler("ggEngineCapabilities"),
    ggEngineGetPermissions: createHandler("ggEngineGetPermissions"),
    ggEngineAgentPreflight: createHandler("ggEngineAgentPreflight"),
    ggEngineAgentRun: createHandler("ggEngineAgentRun"),
    ggEngineAgentStatus: createHandler("ggEngineAgentStatus"),
    ggEngineAgentApply: createHandler("ggEngineAgentApply"),
    ggEngineRequestScreenRecordingPermission: createHandler(
      "ggEngineRequestScreenRecordingPermission",
    ),
    ggEngineRequestMicrophonePermission: createHandler("ggEngineRequestMicrophonePermission"),
    ggEngineRequestInputMonitoringPermission: createHandler(
      "ggEngineRequestInputMonitoringPermission",
    ),
    ggEngineOpenInputMonitoringSettings: createHandler("ggEngineOpenInputMonitoringSettings"),
    ggEngineListSources: createHandler("ggEngineListSources"),
    ggEngineStartDisplayCapture: createHandler("ggEngineStartDisplayCapture"),
    ggEngineStartCurrentWindowCapture: createHandler("ggEngineStartCurrentWindowCapture"),
    ggEngineStartWindowCapture: createHandler("ggEngineStartWindowCapture"),
    ggEngineStopCapture: createHandler("ggEngineStopCapture"),
    ggEngineStartRecording: createHandler("ggEngineStartRecording"),
    ggEngineStopRecording: createHandler("ggEngineStopRecording"),
    ggEngineCaptureStatus: createHandler("ggEngineCaptureStatus"),
    ggEngineCapturePreviewFrame: createHandler("ggEngineCapturePreviewFrame"),
    ggEngineExportInfo: createHandler("ggEngineExportInfo"),
    ggEngineRunExport: createHandler("ggEngineRunExport"),
    ggEngineRunCutPlanExport: createHandler("ggEngineRunCutPlanExport"),
    ggEngineProjectCurrent: createHandler("ggEngineProjectCurrent"),
    ggEngineProjectOpen: createHandler("ggEngineProjectOpen"),
    ggEngineProjectSave: createHandler("ggEngineProjectSave"),
    ggEngineProjectRecents: createHandler("ggEngineProjectRecents"),
    ggReviewSessionSnapshot: createHandler("ggReviewSessionSnapshot"),
    ggGrantReviewMutationCapability: createHandler("ggGrantReviewMutationCapability"),
    ggReviewCreateComment: createHandler("ggReviewCreateComment"),
    ggReviewSetWorkflowStatus: createHandler("ggReviewSetWorkflowStatus"),
    ggPickPath: createHandler("ggPickPath"),
    ggReadTextFile: createHandler("ggReadTextFile"),
    ggGrantMediaSourceCapability: createHandler("ggGrantMediaSourceCapability"),
    ggResolveMediaSourceURL: createHandler("ggResolveMediaSourceURL"),
    ggGrantCapturePreviewCapability: createHandler("ggGrantCapturePreviewCapability"),
    ggResolveCapturePreviewURL: createHandler("ggResolveCapturePreviewURL"),
  });
  function instrument<K extends BridgeRequestName>(name: K) {
    return async (
      params: BridgeRequests[K]["params"],
    ): Promise<BridgeResponseEnvelope<BridgeRequests[K]["response"]>> => {
      const response = await handlers[name](params);
      if (response.ok) {
        return response;
      }
      await run(
        Effect.all(
          [
            Metric.update(
              Metric.withAttributes(desktopBridgeRequestFailuresTotal, { request: name }),
              1,
            ),
            Effect.logError("desktop bridge request failed").pipe(
              Effect.annotateLogs({
                bridgeErrorData: response.error.data ?? null,
                bridgeErrorMessage: response.error.message ?? null,
                bridgeErrorTag: response.error.tag,
                bridgeRequest: name,
                component: "desktop-bridge",
              }),
            ),
          ],
          { discard: true },
        ),
      );
      return { ...response, error: await run(redactBridgeErrorForRendererEffect(response.error)) };
    };
  }
  return {
    ggEnginePing: instrument("ggEnginePing"),
    ggEngineCapabilities: instrument("ggEngineCapabilities"),
    ggEngineGetPermissions: instrument("ggEngineGetPermissions"),
    ggEngineAgentPreflight: instrument("ggEngineAgentPreflight"),
    ggEngineAgentRun: instrument("ggEngineAgentRun"),
    ggEngineAgentStatus: instrument("ggEngineAgentStatus"),
    ggEngineAgentApply: instrument("ggEngineAgentApply"),
    ggEngineRequestScreenRecordingPermission: instrument(
      "ggEngineRequestScreenRecordingPermission",
    ),
    ggEngineRequestMicrophonePermission: instrument("ggEngineRequestMicrophonePermission"),
    ggEngineRequestInputMonitoringPermission: instrument(
      "ggEngineRequestInputMonitoringPermission",
    ),
    ggEngineOpenInputMonitoringSettings: instrument("ggEngineOpenInputMonitoringSettings"),
    ggEngineListSources: instrument("ggEngineListSources"),
    ggEngineStartDisplayCapture: instrument("ggEngineStartDisplayCapture"),
    ggEngineStartCurrentWindowCapture: instrument("ggEngineStartCurrentWindowCapture"),
    ggEngineStartWindowCapture: instrument("ggEngineStartWindowCapture"),
    ggEngineStopCapture: instrument("ggEngineStopCapture"),
    ggEngineStartRecording: instrument("ggEngineStartRecording"),
    ggEngineStopRecording: instrument("ggEngineStopRecording"),
    ggEngineCaptureStatus: instrument("ggEngineCaptureStatus"),
    ggEngineCapturePreviewFrame: instrument("ggEngineCapturePreviewFrame"),
    ggEngineExportInfo: instrument("ggEngineExportInfo"),
    ggEngineRunExport: instrument("ggEngineRunExport"),
    ggEngineRunCutPlanExport: instrument("ggEngineRunCutPlanExport"),
    ggEngineProjectCurrent: instrument("ggEngineProjectCurrent"),
    ggEngineProjectOpen: instrument("ggEngineProjectOpen"),
    ggEngineProjectSave: instrument("ggEngineProjectSave"),
    ggEngineProjectRecents: instrument("ggEngineProjectRecents"),
    ggReviewSessionSnapshot: instrument("ggReviewSessionSnapshot"),
    ggGrantReviewMutationCapability: instrument("ggGrantReviewMutationCapability"),
    ggReviewCreateComment: instrument("ggReviewCreateComment"),
    ggReviewSetWorkflowStatus: instrument("ggReviewSetWorkflowStatus"),
    ggPickPath: instrument("ggPickPath"),
    ggReadTextFile: instrument("ggReadTextFile"),
    ggGrantMediaSourceCapability: instrument("ggGrantMediaSourceCapability"),
    ggResolveMediaSourceURL: instrument("ggResolveMediaSourceURL"),
    ggGrantCapturePreviewCapability: instrument("ggGrantCapturePreviewCapability"),
    ggResolveCapturePreviewURL: instrument("ggResolveCapturePreviewURL"),
  };
}
