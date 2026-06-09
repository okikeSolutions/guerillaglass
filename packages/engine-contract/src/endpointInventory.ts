/**
 * Mapping entry from a v1 RPC method to its v2 HTTP endpoint.
 *
 * @remarks
 * This inventory is used by contract checks to ensure migration coverage stays explicit.
 */
export type EngineEndpointInventoryItem = {
  /**
   * Legacy v1 RPC method name being replaced.
   */
  readonly oldMethod: string;
  /**
   * HTTP verb used by the v2 endpoint.
   */
  readonly method: "GET" | "POST" | "DELETE";
  /**
   * OpenAPI path template for the v2 endpoint.
   */
  readonly path: `/v1/${string}`;
  /**
   * Operation ID expected in generated OpenAPI after normalization.
   */
  readonly operationId: string;
  /**
   * Classification of how the legacy method maps into the v2 contract.
   */
  readonly migration?: "direct" | "replaced_by_polling" | "job_endpoint";
};

/**
 * Complete inventory of legacy engine RPC methods and their v2 HTTP representations.
 */
export const engineEndpointInventory = [
  { oldMethod: "system.ping", method: "GET", path: "/v1/system/ping", operationId: "systemPing", migration: "direct" },
  { oldMethod: "engine.capabilities", method: "GET", path: "/v1/engine/capabilities", operationId: "engineCapabilities", migration: "direct" },
  { oldMethod: "agent.preflight", method: "POST", path: "/v1/agent/preflight", operationId: "agentPreflight", migration: "direct" },
  { oldMethod: "agent.run", method: "POST", path: "/v1/agent/runs", operationId: "agentRun", migration: "job_endpoint" },
  { oldMethod: "agent.status", method: "GET", path: "/v1/agent/runs/{jobId}", operationId: "agentStatus", migration: "job_endpoint" },
  { oldMethod: "agent.apply", method: "POST", path: "/v1/agent/runs/{jobId}/apply", operationId: "agentApply", migration: "job_endpoint" },
  { oldMethod: "permissions.get", method: "GET", path: "/v1/permissions", operationId: "permissionsGet", migration: "direct" },
  { oldMethod: "permissions.requestScreenRecording", method: "POST", path: "/v1/permissions/screen-recording/request", operationId: "permissionsRequestScreenRecording", migration: "direct" },
  { oldMethod: "permissions.requestMicrophone", method: "POST", path: "/v1/permissions/microphone/request", operationId: "permissionsRequestMicrophone", migration: "direct" },
  { oldMethod: "permissions.requestInputMonitoring", method: "POST", path: "/v1/permissions/input-monitoring/request", operationId: "permissionsRequestInputMonitoring", migration: "direct" },
  { oldMethod: "permissions.openInputMonitoringSettings", method: "POST", path: "/v1/permissions/input-monitoring/open-settings", operationId: "permissionsOpenInputMonitoringSettings", migration: "direct" },
  { oldMethod: "sources.list", method: "GET", path: "/v1/sources", operationId: "sourcesList", migration: "direct" },
  { oldMethod: "capture.startDisplay", method: "POST", path: "/v1/capture/start-display", operationId: "captureStartDisplay", migration: "direct" },
  { oldMethod: "capture.startCurrentWindow", method: "POST", path: "/v1/capture/start-current-window", operationId: "captureStartCurrentWindow", migration: "direct" },
  { oldMethod: "capture.startWindow", method: "POST", path: "/v1/capture/start-window", operationId: "captureStartWindow", migration: "direct" },
  { oldMethod: "capture.stop", method: "POST", path: "/v1/capture/stop", operationId: "captureStop", migration: "direct" },
  { oldMethod: "recording.start", method: "POST", path: "/v1/recording/start", operationId: "recordingStart", migration: "direct" },
  { oldMethod: "recording.stop", method: "POST", path: "/v1/recording/stop", operationId: "recordingStop", migration: "direct" },
  { oldMethod: "capture.status", method: "GET", path: "/v1/capture/status", operationId: "captureStatus", migration: "direct" },
  { oldMethod: "capture.statusStream", method: "GET", path: "/v1/capture/status", operationId: "captureStatus", migration: "replaced_by_polling" },
  { oldMethod: "capture.previewFrame", method: "GET", path: "/v1/capture/preview-frame", operationId: "capturePreviewFrame", migration: "direct" },
  { oldMethod: "capture.previewFrameStream", method: "GET", path: "/v1/capture/preview-frame", operationId: "capturePreviewFrame", migration: "replaced_by_polling" },
  { oldMethod: "export.info", method: "GET", path: "/v1/export/info", operationId: "exportInfo", migration: "direct" },
  { oldMethod: "export.run", method: "POST", path: "/v1/exports", operationId: "exportRun", migration: "job_endpoint" },
  { oldMethod: "export.runCutPlan", method: "POST", path: "/v1/exports/from-cut-plan", operationId: "exportRunCutPlan", migration: "job_endpoint" },
  { oldMethod: "project.current", method: "GET", path: "/v1/project/current", operationId: "projectCurrent", migration: "direct" },
  { oldMethod: "project.open", method: "POST", path: "/v1/project/open", operationId: "projectOpen", migration: "direct" },
  { oldMethod: "project.save", method: "POST", path: "/v1/project/save", operationId: "projectSave", migration: "direct" },
  { oldMethod: "project.recents", method: "GET", path: "/v1/project/recents", operationId: "projectRecents", migration: "direct" },
] as const satisfies readonly EngineEndpointInventoryItem[];

/**
 * Unique v2 operation IDs represented by {@link engineEndpointInventory}.
 */
export const engineEndpointOperationIds = Array.from(
  new Set(engineEndpointInventory.map((item) => item.operationId)),
);
