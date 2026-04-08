/**
 * Canonical JSON-RPC method names supported by the engine protocol.
 *
 * Keep these values stable across shell and native engine releases. The method map is the
 * single source of truth for literal method strings used by request schemas and bridge code.
 */
export const engineMethods = {
  SystemPing: "system.ping",
  EngineCapabilities: "engine.capabilities",
  AgentPreflight: "agent.preflight",
  AgentRun: "agent.run",
  AgentStatus: "agent.status",
  AgentApply: "agent.apply",
  PermissionsGet: "permissions.get",
  PermissionsRequestScreenRecording: "permissions.requestScreenRecording",
  PermissionsRequestMicrophone: "permissions.requestMicrophone",
  PermissionsRequestInputMonitoring: "permissions.requestInputMonitoring",
  PermissionsOpenInputMonitoringSettings: "permissions.openInputMonitoringSettings",
  SourcesList: "sources.list",
  CaptureStartDisplay: "capture.startDisplay",
  CaptureStartCurrentWindow: "capture.startCurrentWindow",
  CaptureStartWindow: "capture.startWindow",
  CaptureStop: "capture.stop",
  RecordingStart: "recording.start",
  RecordingStop: "recording.stop",
  CaptureStatus: "capture.status",
  CapturePreviewFrame: "capture.previewFrame",
  ExportInfo: "export.info",
  ExportRun: "export.run",
  ExportRunCutPlan: "export.runCutPlan",
  ProjectCurrent: "project.current",
  ProjectOpen: "project.open",
  ProjectSave: "project.save",
  ProjectRecents: "project.recents",
} as const;

/** Union type of supported engine JSON-RPC methods. */
export type EngineMethod = (typeof engineMethods)[keyof typeof engineMethods];

/**
 * Stable list of all supported engine methods in declaration order.
 *
 * Consumers can use this for capability tables, diagnostics, or iteration without rebuilding
 * the literal union from `engineMethods`.
 */
export const engineMethodList = Object.values(engineMethods) as EngineMethod[];
