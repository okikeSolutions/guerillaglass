use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Protocol version shared between shell and native engines.
pub const PROTOCOL_VERSION: &str = "2";

/// Request envelope sent over line-delimited JSON transport.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineRequest {
    pub id: String,
    pub method: String,
    #[serde(default = "default_params")]
    pub params: Value,
}

include!(concat!(env!("OUT_DIR"), "/engine_methods_generated.rs"));

impl EngineRequest {
    /// Attempts to map the raw method string to a known engine method variant.
    pub fn method_kind(&self) -> Option<EngineMethod> {
        EngineMethod::try_from(self.method.as_str()).ok()
    }
}

/// Stable engine error codes serialized in snake_case.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolErrorCode {
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

/// Error payload returned by failed responses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineError {
    pub code: ProtocolErrorCode,
    pub message: String,
}

/// Success response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineSuccessResponse {
    pub id: String,
    pub ok: bool,
    pub result: Value,
}

/// Error response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineErrorResponse {
    pub id: String,
    pub ok: bool,
    pub error: EngineError,
}

/// Untagged response union used by line codecs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EngineResponse {
    Success(EngineSuccessResponse),
    Error(EngineErrorResponse),
}

/// Decodes a JSON request line into a typed request envelope.
pub fn decode_request_line(line: &str) -> Result<EngineRequest, serde_json::Error> {
    serde_json::from_str(line)
}

/// Encodes a typed response envelope into a JSON line.
pub fn encode_response_line(response: &EngineResponse) -> Result<String, serde_json::Error> {
    serde_json::to_string(response)
}

/// Creates a success response payload for a request id.
pub fn success(id: impl Into<String>, result: Value) -> EngineResponse {
    EngineResponse::Success(EngineSuccessResponse {
        id: id.into(),
        ok: true,
        result,
    })
}

/// Creates an error response payload for a request id.
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
        assert_eq!(
            request.method_kind(),
            Some(EngineMethod::EngineCapabilities)
        );
        assert_eq!(request.params.get("verbose"), Some(&Value::Bool(true)));
    }

    #[test]
    fn defaults_params_when_missing() {
        let request =
            decode_request_line(r#"{"id":"r2","method":"system.ping"}"#).expect("decode request");
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
