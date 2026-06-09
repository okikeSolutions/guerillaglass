use crate::{ENGINE_PHASE, ENGINE_VERSION};
use crate::wire::{success, EngineResponse, JsonRpcId, PROTOCOL_VERSION};
use serde_json::json;

pub(crate) fn ping(id: &JsonRpcId, platform: &str) -> EngineResponse {
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

pub(crate) fn capabilities(id: &JsonRpcId, platform: &str) -> EngineResponse {
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
