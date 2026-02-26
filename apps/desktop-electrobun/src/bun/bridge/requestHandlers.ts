import type { BridgeRequestHandlerMap, HostPathPickerMode } from "../../shared/bridgeRpc";
import { createBunBridgeHandlers } from "../../shared/bridgeBindings";
import type { EngineClient } from "../engine/client";

type BridgeHandlerDependencies = {
  engineClient: EngineClient;
  pickPath: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  resolveMediaSourceURL: (filePath: string) => Promise<string>;
  setCurrentProjectPath: (projectPath: string | null) => void;
};

/** Creates bridge RPC handlers backed by the desktop engine client. */
export function createEngineBridgeHandlers({
  engineClient,
  pickPath,
  readTextFile,
  resolveMediaSourceURL,
  setCurrentProjectPath,
}: BridgeHandlerDependencies): BridgeRequestHandlerMap {
  return createBunBridgeHandlers({
    ggEnginePing: async () => engineClient.ping(),
    ggEngineGetPermissions: async () => engineClient.getPermissions(),
    ggEngineAgentPreflight: async (params) => engineClient.agentPreflight(params),
    ggEngineAgentRun: async (params) => engineClient.agentRun(params),
    ggEngineAgentStatus: async ({ jobId }) => engineClient.agentStatus(jobId),
    ggEngineAgentApply: async (params) => engineClient.agentApply(params),
    ggEngineRequestScreenRecordingPermission: async () =>
      engineClient.requestScreenRecordingPermission(),
    ggEngineRequestMicrophonePermission: async () => engineClient.requestMicrophonePermission(),
    ggEngineRequestInputMonitoringPermission: async () =>
      engineClient.requestInputMonitoringPermission(),
    ggEngineOpenInputMonitoringSettings: async () => engineClient.openInputMonitoringSettings(),
    ggEngineListSources: async () => engineClient.listSources(),
    ggEngineStartDisplayCapture: async ({ enableMic, captureFps }) =>
      engineClient.startDisplayCapture(enableMic, captureFps),
    ggEngineStartCurrentWindowCapture: async ({ enableMic, captureFps }) =>
      engineClient.startCurrentWindowCapture(enableMic, captureFps),
    ggEngineStartWindowCapture: async ({ windowId, enableMic, captureFps }) =>
      engineClient.startWindowCapture(windowId, enableMic, captureFps),
    ggEngineStopCapture: async () => engineClient.stopCapture(),
    ggEngineStartRecording: async ({ trackInputEvents }) =>
      engineClient.startRecording(trackInputEvents),
    ggEngineStopRecording: async () => engineClient.stopRecording(),
    ggEngineCaptureStatus: async () => engineClient.captureStatus(),
    ggEngineExportInfo: async () => engineClient.exportInfo(),
    ggEngineRunExport: async (params) => engineClient.runExport(params),
    ggEngineRunCutPlanExport: async (params) => engineClient.runCutPlanExport(params),
    ggEngineProjectCurrent: async () => {
      const projectState = await engineClient.projectCurrent();
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectOpen: async ({ projectPath }) => {
      const projectState = await engineClient.projectOpen(projectPath);
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectSave: async (params) => {
      const projectState = await engineClient.projectSave(params);
      setCurrentProjectPath(projectState.projectPath);
      return projectState;
    },
    ggEngineProjectRecents: async ({ limit }) => engineClient.projectRecents(limit),
    ggPickPath: async ({ mode, startingFolder }) => pickPath({ mode, startingFolder }),
    ggReadTextFile: async ({ filePath }) => readTextFile(filePath),
    ggResolveMediaSourceURL: async ({ filePath }) => {
      try {
        return await resolveMediaSourceURL(filePath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`ggResolveMediaSourceURL failed for "${filePath}": ${reason}`);
        throw error;
      }
    },
  });
}
