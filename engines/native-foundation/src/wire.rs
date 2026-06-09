use serde_json::Value;
use std::time::Instant;

pub(crate) const PROTOCOL_VERSION: &str = "2";

pub(crate) type JsonRpcId = String;

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ProtocolErrorCode {
    InvalidRequest,
    InvalidParams,
    UnsupportedMethod,
    PermissionDenied,
    NeedsConfirmation,
    QaFailed,
    MissingLocalModel,
    InvalidCutPlan,
    RuntimeError,
}

impl ProtocolErrorCode {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            Self::InvalidRequest => "invalid_request",
            Self::InvalidParams => "invalid_params",
            Self::UnsupportedMethod => "unsupported_method",
            Self::PermissionDenied => "permission_denied",
            Self::NeedsConfirmation => "needs_confirmation",
            Self::QaFailed => "qa_failed",
            Self::MissingLocalModel => "missing_local_model",
            Self::InvalidCutPlan => "invalid_cut_plan",
            Self::RuntimeError => "runtime_error",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct EngineError {
    pub(crate) code: ProtocolErrorCode,
    pub(crate) message: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub(crate) enum EngineResponse {
    Success { id: JsonRpcId, result: Value },
    Error { id: JsonRpcId, error: EngineError },
}

pub(crate) fn success(id: &JsonRpcId, result: Value) -> EngineResponse {
    EngineResponse::Success { id: id.clone(), result }
}

pub(crate) fn failure(
    id: &JsonRpcId,
    code: ProtocolErrorCode,
    message: impl Into<String>,
) -> EngineResponse {
    EngineResponse::Error {
        id: id.clone(),
        error: EngineError { code, message: message.into() },
    }
}

#[derive(Debug, Clone)]
pub(crate) struct EngineRequest {
    pub(crate) id: JsonRpcId,
    pub(crate) method: String,
    pub(crate) params: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EngineMethod {
    SystemPing,
    EngineCapabilities,
    AgentPreflight,
    AgentRun,
    AgentStatus,
    AgentApply,
    PermissionsGet,
    PermissionsRequestScreenRecording,
    PermissionsRequestMicrophone,
    PermissionsRequestInputMonitoring,
    PermissionsOpenInputMonitoringSettings,
    SourcesList,
    CaptureStartDisplay,
    CaptureStartCurrentWindow,
    CaptureStartWindow,
    CaptureStop,
    RecordingStart,
    RecordingStop,
    CaptureStatus,
    CaptureStatusStream,
    CapturePreviewFrame,
    CapturePreviewFrameStream,
    ExportInfo,
    ExportRun,
    ExportRunCutPlan,
    ProjectCurrent,
    ProjectOpen,
    ProjectSave,
    ProjectRecents,
}

impl EngineRequest {
    pub(crate) fn method_kind(&self) -> Option<EngineMethod> {
        Some(match self.method.as_str() {
            "system.ping" => EngineMethod::SystemPing,
            "engine.capabilities" => EngineMethod::EngineCapabilities,
            "agent.preflight" => EngineMethod::AgentPreflight,
            "agent.run" => EngineMethod::AgentRun,
            "agent.status" => EngineMethod::AgentStatus,
            "agent.apply" => EngineMethod::AgentApply,
            "permissions.get" => EngineMethod::PermissionsGet,
            "permissions.requestScreenRecording" => EngineMethod::PermissionsRequestScreenRecording,
            "permissions.requestMicrophone" => EngineMethod::PermissionsRequestMicrophone,
            "permissions.requestInputMonitoring" => EngineMethod::PermissionsRequestInputMonitoring,
            "permissions.openInputMonitoringSettings" => EngineMethod::PermissionsOpenInputMonitoringSettings,
            "sources.list" => EngineMethod::SourcesList,
            "capture.startDisplay" => EngineMethod::CaptureStartDisplay,
            "capture.startCurrentWindow" => EngineMethod::CaptureStartCurrentWindow,
            "capture.startWindow" => EngineMethod::CaptureStartWindow,
            "capture.stop" => EngineMethod::CaptureStop,
            "recording.start" => EngineMethod::RecordingStart,
            "recording.stop" => EngineMethod::RecordingStop,
            "capture.status" => EngineMethod::CaptureStatus,
            "capture.statusStream" => EngineMethod::CaptureStatusStream,
            "capture.previewFrame" => EngineMethod::CapturePreviewFrame,
            "capture.previewFrameStream" => EngineMethod::CapturePreviewFrameStream,
            "export.info" => EngineMethod::ExportInfo,
            "export.run" => EngineMethod::ExportRun,
            "export.runCutPlan" => EngineMethod::ExportRunCutPlan,
            "project.current" => EngineMethod::ProjectCurrent,
            "project.open" => EngineMethod::ProjectOpen,
            "project.save" => EngineMethod::ProjectSave,
            "project.recents" => EngineMethod::ProjectRecents,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone)]
pub(crate) struct CaptureClock {
    started: Instant,
}

impl Default for CaptureClock {
    fn default() -> Self {
        Self { started: Instant::now() }
    }
}

impl CaptureClock {
    fn elapsed_seconds(&self) -> f64 {
        self.started.elapsed().as_secs_f64()
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct RunningDuration {
    accumulated_seconds: f64,
    started_at_seconds: Option<f64>,
}

impl RunningDuration {
    pub(crate) fn start(&mut self, clock: &CaptureClock) {
        if self.started_at_seconds.is_none() {
            self.started_at_seconds = Some(clock.elapsed_seconds());
        }
    }

    pub(crate) fn stop(&mut self, clock: &CaptureClock) {
        if let Some(started_at_seconds) = self.started_at_seconds.take() {
            self.accumulated_seconds += clock.elapsed_seconds() - started_at_seconds;
        }
    }

    pub(crate) fn current(&self, clock: &CaptureClock) -> f64 {
        self.accumulated_seconds
            + self
                .started_at_seconds
                .map(|started_at_seconds| clock.elapsed_seconds() - started_at_seconds)
                .unwrap_or(0.0)
    }
}
