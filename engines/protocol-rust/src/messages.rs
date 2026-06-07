use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Protocol version shared between shell and native engines.
pub const PROTOCOL_VERSION: &str = "2";

/// JSON-RPC id value supported by Effect RPC JSON-RPC serialization.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcId {
    String(String),
    Number(i64),
}

impl From<&str> for JsonRpcId {
    fn from(value: &str) -> Self {
        Self::String(value.to_string())
    }
}

impl From<String> for JsonRpcId {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<i64> for JsonRpcId {
    fn from(value: i64) -> Self {
        Self::Number(value)
    }
}

impl From<&JsonRpcId> for JsonRpcId {
    fn from(value: &JsonRpcId) -> Self {
        value.clone()
    }
}

/// Request envelope sent over the stable Guerillaglass newline-delimited wire protocol.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineRequest {
    #[serde(rename = "type", default = "default_request_type")]
    pub message_type: String,
    pub id: JsonRpcId,
    pub method: String,
    #[serde(default = "default_params")]
    pub params: Value,
    #[serde(rename = "authToken", skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineWireError {
    pub code: ProtocolErrorCode,
    pub message: String,
}

/// Stable response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EngineResponse {
    #[serde(rename = "response")]
    Success { id: JsonRpcId, result: Value },
    #[serde(rename = "error")]
    Error { id: JsonRpcId, error: EngineWireError },
    #[serde(rename = "chunk")]
    Chunk { id: JsonRpcId, values: Vec<Value> },
}

/// Decodes a JSON-RPC request line into a typed request envelope.
pub fn decode_request_line(line: &str) -> Result<EngineRequest, serde_json::Error> {
    serde_json::from_str(line)
}

/// Encodes a typed response envelope into a JSON line.
pub fn encode_response_line(response: &EngineResponse) -> Result<String, serde_json::Error> {
    serde_json::to_string(response)
}

/// Creates a streaming chunk response payload for a request id.
pub fn chunk(id: impl Into<JsonRpcId>, values: Vec<Value>) -> EngineResponse {
    EngineResponse::Chunk {
        id: id.into(),
        values,
    }
}

/// Creates a success response payload for a request id.
pub fn success(id: impl Into<JsonRpcId>, result: Value) -> EngineResponse {
    EngineResponse::Success {
        id: id.into(),
        result,
    }
}

/// Creates an Effect RPC typed error response payload for a request id.
pub fn failure(
    id: impl Into<JsonRpcId>,
    code: ProtocolErrorCode,
    message: impl Into<String>,
) -> EngineResponse {
    let message = message.into();
    EngineResponse::Error {
        id: id.into(),
        error: EngineWireError { code, message },
    }
}

fn default_params() -> Value {
    json!({})
}

fn default_request_type() -> String {
    "request".to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        chunk, decode_request_line, failure, success, EngineMethod, JsonRpcId, ProtocolErrorCode,
        PROTOCOL_VERSION,
    };
    use serde_json::{json, Value};

    #[test]
    fn decodes_method_and_params() {
        let request = decode_request_line(
            r#"{"type":"request","id":1,"method":"engine.capabilities","params":{"verbose":true}}"#,
        )
        .expect("decode request");

        assert_eq!(request.id, JsonRpcId::Number(1));
        assert_eq!(
            request.method_kind(),
            Some(EngineMethod::EngineCapabilities)
        );
        assert_eq!(request.params.get("verbose"), Some(&Value::Bool(true)));
    }

    #[test]
    fn defaults_params_when_missing() {
        let request = decode_request_line(r#"{"type":"request","id":2,"method":"system.ping"}"#)
            .expect("decode request");
        assert_eq!(request.params, json!({}));
    }

    #[test]
    fn encodes_success_and_failure_responses() {
        let success_line = serde_json::to_string(&success(
            1_i64,
            json!({"protocolVersion": PROTOCOL_VERSION}),
        ))
        .expect("encode success");
        assert!(success_line.contains("\"type\":\"response\""));
        assert!(success_line.contains("\"result\""));

        let failure_line = serde_json::to_string(&failure(
            2_i64,
            ProtocolErrorCode::UnsupportedMethod,
            "unsupported",
        ))
        .expect("encode failure");
        assert!(failure_line.contains("\"type\":\"error\""));
        assert!(failure_line.contains("\"unsupported_method\""));

        let chunk_line = serde_json::to_string(&chunk(3_i64, vec![json!({ "ok": true })]))
            .expect("encode chunk");
        assert!(chunk_line.contains("\"type\":\"chunk\""));
        assert!(chunk_line.contains("\"values\":["));
    }
}
