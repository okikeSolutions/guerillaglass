import { Electroview } from "electrobun/view";
import type { AutoZoomSettings } from "@guerillaglass/engine-protocol";
import type { DesktopBridgeRPC, HostMenuCommand, HostMenuState } from "../../shared/bridgeRpc";

type ElectrobunRuntimeWindow = Window & {
  __electrobun?: unknown;
};

let bridgeInitialized = false;

export function initializeElectrobunRpcBridge(): void {
  if (bridgeInitialized) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  if (!(window as ElectrobunRuntimeWindow).__electrobun) {
    return;
  }

  const rpc = Electroview.defineRPC<DesktopBridgeRPC>({
    handlers: {
      requests: {},
      messages: {
        hostMenuCommand: ({ command }: { command: HostMenuCommand }) => {
          window.dispatchEvent(
            new CustomEvent("gg-host-menu-command", {
              detail: { command },
            }),
          );
        },
      },
    },
  });
  new Electroview({ rpc });

  window.ggEnginePing = () => rpc.request.ggEnginePing();
  window.ggEngineGetPermissions = () => rpc.request.ggEngineGetPermissions();
  window.ggEngineRequestScreenRecordingPermission = () =>
    rpc.request.ggEngineRequestScreenRecordingPermission();
  window.ggEngineRequestMicrophonePermission = () =>
    rpc.request.ggEngineRequestMicrophonePermission();
  window.ggEngineRequestInputMonitoringPermission = () =>
    rpc.request.ggEngineRequestInputMonitoringPermission();
  window.ggEngineOpenInputMonitoringSettings = () =>
    rpc.request.ggEngineOpenInputMonitoringSettings();
  window.ggEngineListSources = () => rpc.request.ggEngineListSources();
  window.ggEngineStartDisplayCapture = (enableMic: boolean) =>
    rpc.request.ggEngineStartDisplayCapture({ enableMic });
  window.ggEngineStartWindowCapture = (windowId: number, enableMic: boolean) =>
    rpc.request.ggEngineStartWindowCapture({ windowId, enableMic });
  window.ggEngineStopCapture = () => rpc.request.ggEngineStopCapture();
  window.ggEngineStartRecording = (trackInputEvents: boolean) =>
    rpc.request.ggEngineStartRecording({ trackInputEvents });
  window.ggEngineStopRecording = () => rpc.request.ggEngineStopRecording();
  window.ggEngineCaptureStatus = () => rpc.request.ggEngineCaptureStatus();
  window.ggEngineExportInfo = () => rpc.request.ggEngineExportInfo();
  window.ggEngineRunExport = (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) => rpc.request.ggEngineRunExport(params);
  window.ggEngineProjectCurrent = () => rpc.request.ggEngineProjectCurrent();
  window.ggEngineProjectOpen = (projectPath: string) =>
    rpc.request.ggEngineProjectOpen({ projectPath });
  window.ggEngineProjectSave = (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) =>
    rpc.request.ggEngineProjectSave(params);
  window.ggPickDirectory = (startingFolder?: string) =>
    rpc.request.ggPickDirectory({ startingFolder });
  window.ggHostSendMenuState = (state: HostMenuState) => rpc.send.hostMenuState(state);

  bridgeInitialized = true;
}
