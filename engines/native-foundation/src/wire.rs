use serde_json::Value;
use std::time::Instant;

pub(crate) const PROTOCOL_VERSION: &str = "2";

pub(crate) type EngineCallId = str;

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
    PreflightExpired,
    PreflightMismatch,
    NotFound,
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
            Self::PreflightExpired => "preflight_expired",
            Self::PreflightMismatch => "preflight_mismatch",
            Self::NotFound => "not_found",
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
    Success { id: String, result: Value },
    Error { id: String, error: EngineError },
}

pub(crate) fn success(id: &EngineCallId, result: Value) -> EngineResponse {
    EngineResponse::Success {
        id: id.to_string(),
        result,
    }
}

pub(crate) fn failure(
    id: &EngineCallId,
    code: ProtocolErrorCode,
    message: impl Into<String>,
) -> EngineResponse {
    EngineResponse::Error {
        id: id.to_string(),
        error: EngineError {
            code,
            message: message.into(),
        },
    }
}

#[cfg(test)]
#[derive(Debug, Clone)]
pub(crate) struct EngineRequest {
    pub(crate) id: String,
    pub(crate) method: EngineMethod,
    pub(crate) params: Value,
}

#[allow(dead_code)] // Legacy internal dispatcher remains testable while unsupported HTTP methods fail truthfully.
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
    CapturePreviewFrame,
    ExportInfo,
    ExportRun,
    ExportRunCutPlan,
    ProjectCurrent,
    ProjectOpen,
    ProjectSave,
    ProjectRecents,
}

impl EngineMethod {
    pub(crate) fn call_id(self) -> &'static EngineCallId {
        match self {
            EngineMethod::SystemPing => "system.ping",
            EngineMethod::EngineCapabilities => "engine.capabilities",
            EngineMethod::AgentPreflight => "agent.preflight",
            EngineMethod::AgentRun => "agent.run",
            EngineMethod::AgentStatus => "agent.status",
            EngineMethod::AgentApply => "agent.apply",
            EngineMethod::PermissionsGet => "permissions.get",
            EngineMethod::PermissionsRequestScreenRecording => "permissions.requestScreenRecording",
            EngineMethod::PermissionsRequestMicrophone => "permissions.requestMicrophone",
            EngineMethod::PermissionsRequestInputMonitoring => "permissions.requestInputMonitoring",
            EngineMethod::PermissionsOpenInputMonitoringSettings => {
                "permissions.openInputMonitoringSettings"
            }
            EngineMethod::SourcesList => "sources.list",
            EngineMethod::CaptureStartDisplay => "capture.startDisplay",
            EngineMethod::CaptureStartCurrentWindow => "capture.startCurrentWindow",
            EngineMethod::CaptureStartWindow => "capture.startWindow",
            EngineMethod::CaptureStop => "capture.stop",
            EngineMethod::RecordingStart => "recording.start",
            EngineMethod::RecordingStop => "recording.stop",
            EngineMethod::CaptureStatus => "capture.status",
            EngineMethod::CapturePreviewFrame => "capture.previewFrame",
            EngineMethod::ExportInfo => "export.info",
            EngineMethod::ExportRun => "export.run",
            EngineMethod::ExportRunCutPlan => "export.runCutPlan",
            EngineMethod::ProjectCurrent => "project.current",
            EngineMethod::ProjectOpen => "project.open",
            EngineMethod::ProjectSave => "project.save",
            EngineMethod::ProjectRecents => "project.recents",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct CaptureClock {
    started: Instant,
}

impl Default for CaptureClock {
    fn default() -> Self {
        Self {
            started: Instant::now(),
        }
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
