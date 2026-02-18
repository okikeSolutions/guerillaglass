use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const PROTOCOL_VERSION: &str = "2";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineRequest {
    pub id: String,
    pub method: String,
    #[serde(default = "default_params")]
    pub params: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineMethod {
    SystemPing,
    EngineCapabilities,
    PermissionsGet,
    PermissionsRequestScreenRecording,
    PermissionsRequestMicrophone,
    PermissionsRequestInputMonitoring,
    PermissionsOpenInputMonitoringSettings,
    SourcesList,
    CaptureStartDisplay,
    CaptureStartWindow,
    CaptureStop,
    RecordingStart,
    RecordingStop,
    CaptureStatus,
    ExportInfo,
    ExportRun,
    ProjectCurrent,
    ProjectOpen,
    ProjectSave,
}

impl EngineMethod {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::SystemPing => "system.ping",
            Self::EngineCapabilities => "engine.capabilities",
            Self::PermissionsGet => "permissions.get",
            Self::PermissionsRequestScreenRecording => "permissions.requestScreenRecording",
            Self::PermissionsRequestMicrophone => "permissions.requestMicrophone",
            Self::PermissionsRequestInputMonitoring => "permissions.requestInputMonitoring",
            Self::PermissionsOpenInputMonitoringSettings => "permissions.openInputMonitoringSettings",
            Self::SourcesList => "sources.list",
            Self::CaptureStartDisplay => "capture.startDisplay",
            Self::CaptureStartWindow => "capture.startWindow",
            Self::CaptureStop => "capture.stop",
            Self::RecordingStart => "recording.start",
            Self::RecordingStop => "recording.stop",
            Self::CaptureStatus => "capture.status",
            Self::ExportInfo => "export.info",
            Self::ExportRun => "export.run",
            Self::ProjectCurrent => "project.current",
            Self::ProjectOpen => "project.open",
            Self::ProjectSave => "project.save",
        }
    }
}

impl TryFrom<&str> for EngineMethod {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "system.ping" => Ok(Self::SystemPing),
            "engine.capabilities" => Ok(Self::EngineCapabilities),
            "permissions.get" => Ok(Self::PermissionsGet),
            "permissions.requestScreenRecording" => Ok(Self::PermissionsRequestScreenRecording),
            "permissions.requestMicrophone" => Ok(Self::PermissionsRequestMicrophone),
            "permissions.requestInputMonitoring" => Ok(Self::PermissionsRequestInputMonitoring),
            "permissions.openInputMonitoringSettings" => {
                Ok(Self::PermissionsOpenInputMonitoringSettings)
            }
            "sources.list" => Ok(Self::SourcesList),
            "capture.startDisplay" => Ok(Self::CaptureStartDisplay),
            "capture.startWindow" => Ok(Self::CaptureStartWindow),
            "capture.stop" => Ok(Self::CaptureStop),
            "recording.start" => Ok(Self::RecordingStart),
            "recording.stop" => Ok(Self::RecordingStop),
            "capture.status" => Ok(Self::CaptureStatus),
            "export.info" => Ok(Self::ExportInfo),
            "export.run" => Ok(Self::ExportRun),
            "project.current" => Ok(Self::ProjectCurrent),
            "project.open" => Ok(Self::ProjectOpen),
            "project.save" => Ok(Self::ProjectSave),
            _ => Err(()),
        }
    }
}

impl EngineRequest {
    pub fn method_kind(&self) -> Option<EngineMethod> {
        EngineMethod::try_from(self.method.as_str()).ok()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolErrorCode {
    InvalidRequest,
    InvalidParams,
    UnsupportedMethod,
    PermissionDenied,
    RuntimeError,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineError {
    pub code: ProtocolErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineSuccessResponse {
    pub id: String,
    pub ok: bool,
    pub result: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineErrorResponse {
    pub id: String,
    pub ok: bool,
    pub error: EngineError,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EngineResponse {
    Success(EngineSuccessResponse),
    Error(EngineErrorResponse),
}

pub fn decode_request_line(line: &str) -> Result<EngineRequest, serde_json::Error> {
    serde_json::from_str(line)
}

pub fn encode_response_line(response: &EngineResponse) -> Result<String, serde_json::Error> {
    serde_json::to_string(response)
}

pub fn success(id: impl Into<String>, result: Value) -> EngineResponse {
    EngineResponse::Success(EngineSuccessResponse {
        id: id.into(),
        ok: true,
        result,
    })
}

pub fn failure(
    id: impl Into<String>,
    code: ProtocolErrorCode,
    message: impl Into<String>,
) -> EngineResponse {
    EngineResponse::Error(EngineErrorResponse {
        id: id.into(),
        ok: false,
        error: EngineError {
            code,
            message: message.into(),
        },
    })
}

fn default_params() -> Value {
    json!({})
}

#[cfg(test)]
mod tests {
    use super::{decode_request_line, success, EngineMethod, ProtocolErrorCode, PROTOCOL_VERSION};
    use crate::messages::failure;
    use serde_json::{json, Value};

    #[test]
    fn decodes_method_and_params() {
        let request = decode_request_line(
            r#"{"id":"r1","method":"engine.capabilities","params":{"verbose":true}}"#,
        )
        .expect("decode request");

        assert_eq!(request.id, "r1");
        assert_eq!(request.method_kind(), Some(EngineMethod::EngineCapabilities));
        assert_eq!(request.params.get("verbose"), Some(&Value::Bool(true)));
    }

    #[test]
    fn defaults_params_when_missing() {
        let request = decode_request_line(r#"{"id":"r2","method":"system.ping"}"#)
            .expect("decode request");
        assert_eq!(request.params, json!({}));
    }

    #[test]
    fn encodes_success_and_failure_responses() {
        let success_line =
            serde_json::to_string(&success("ok", json!({"protocolVersion": PROTOCOL_VERSION})))
                .expect("encode success");
        assert!(success_line.contains("\"ok\":true"));

        let failure_line = serde_json::to_string(&failure(
            "err",
            ProtocolErrorCode::UnsupportedMethod,
            "unsupported",
        ))
        .expect("encode failure");
        assert!(failure_line.contains("\"unsupported_method\""));
    }
}
