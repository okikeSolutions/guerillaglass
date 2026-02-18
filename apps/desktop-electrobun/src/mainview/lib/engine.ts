import {
  captureStatusResultSchema,
  permissionsResultSchema,
  pingResultSchema,
  sourcesResultSchema,
  type CaptureStatusResult,
  type PermissionsResult,
  type PingResult,
  type SourcesResult,
} from "@guerillaglass/engine-protocol";

declare global {
  interface Window {
    ggEnginePing?: () => Promise<unknown>;
    ggEngineGetPermissions?: () => Promise<unknown>;
    ggEngineListSources?: () => Promise<unknown>;
    ggEngineCaptureStatus?: () => Promise<unknown>;
  }
}

function requireBridge<T extends (...args: never[]) => Promise<unknown>>(
  bridge: T | undefined,
  name: string,
): T {
  if (!bridge) {
    throw new Error(`Missing Electrobun bridge: ${name}`);
  }
  return bridge;
}

export const engineApi = {
  async ping(): Promise<PingResult> {
    return pingResultSchema.parse(await requireBridge(window.ggEnginePing, "ggEnginePing")());
  },

  async getPermissions(): Promise<PermissionsResult> {
    return permissionsResultSchema.parse(
      await requireBridge(window.ggEngineGetPermissions, "ggEngineGetPermissions")(),
    );
  },

  async listSources(): Promise<SourcesResult> {
    return sourcesResultSchema.parse(
      await requireBridge(window.ggEngineListSources, "ggEngineListSources")(),
    );
  },

  async captureStatus(): Promise<CaptureStatusResult> {
    return captureStatusResultSchema.parse(
      await requireBridge(window.ggEngineCaptureStatus, "ggEngineCaptureStatus")(),
    );
  },
};
