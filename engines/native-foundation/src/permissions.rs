use crate::wire::{success, EngineCallId, EngineResponse};
use serde_json::json;

pub(crate) fn get(id: &EngineCallId) -> EngineResponse {
    success(
        id,
        json!({
            "screenRecordingGranted": true,
            "microphoneGranted": true,
            "inputMonitoring": "authorized",
        }),
    )
}

pub(crate) fn request_or_open_settings(id: &EngineCallId) -> EngineResponse {
    success(
        id,
        json!({
            "success": true,
            "message": "Permission flow wiring is active. Native policy integration pending.",
        }),
    )
}
