use crate::wire::{success, EngineCallId, EngineResponse, PROTOCOL_VERSION};
use crate::{ENGINE_PHASE, ENGINE_VERSION};
use serde_json::json;

pub(crate) fn ping(id: &EngineCallId, platform: &str) -> EngineResponse {
    success(
        id,
        json!({
            "app": "guerillaglass",
            "engineVersion": ENGINE_VERSION,
            "protocolVersion": PROTOCOL_VERSION,
            "platform": platform,
        }),
    )
}

pub(crate) fn capabilities(id: &EngineCallId, platform: &str) -> EngineResponse {
    success(
        id,
        json!({
            "protocolVersion": PROTOCOL_VERSION,
            "platform": platform,
            "phase": ENGINE_PHASE,
            "capture": {
                "display": true,
                "window": true,
                "systemAudio": true,
                "microphone": true,
            },
            "recording": {
                "inputTracking": true,
            },
            "export": {
                "presets": true,
                "cutPlan": true,
                "backgroundFraming": false,
            },
            "project": {
                "openSave": true,
            },
            "agent": {
                "preflight": true,
                "run": true,
                "status": true,
                "apply": true,
                "localOnly": true,
                "runtimeBudgetMinutes": 10,
            }
        }),
    )
}
