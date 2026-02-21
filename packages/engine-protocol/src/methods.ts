export const engineMethods = {
  SystemPing: "system.ping",
  EngineCapabilities: "engine.capabilities",
  PermissionsGet: "permissions.get",
  PermissionsRequestScreenRecording: "permissions.requestScreenRecording",
  PermissionsRequestMicrophone: "permissions.requestMicrophone",
  PermissionsRequestInputMonitoring: "permissions.requestInputMonitoring",
  PermissionsOpenInputMonitoringSettings: "permissions.openInputMonitoringSettings",
  SourcesList: "sources.list",
  CaptureStartDisplay: "capture.startDisplay",
  CaptureStartWindow: "capture.startWindow",
  CaptureStop: "capture.stop",
  RecordingStart: "recording.start",
  RecordingStop: "recording.stop",
  CaptureStatus: "capture.status",
  ExportInfo: "export.info",
  ExportRun: "export.run",
  ProjectCurrent: "project.current",
  ProjectOpen: "project.open",
  ProjectSave: "project.save",
  ProjectRecents: "project.recents",
} as const;

export type EngineMethod = (typeof engineMethods)[keyof typeof engineMethods];

export const engineMethodList = Object.values(engineMethods) as EngineMethod[];
