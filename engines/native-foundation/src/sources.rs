use crate::wire::{success, EngineCallId, EngineResponse};
use crate::DEFAULT_CAPTURE_FRAME_RATES;
use serde_json::json;

pub(crate) fn list(id: &EngineCallId) -> EngineResponse {
    success(
        id,
        json!({
            "displays": [
                {
                    "id": 1,
                    "displayName": "Primary Display",
                    "isPrimary": true,
                    "width": 1920,
                    "height": 1080,
                    "pixelScale": 1.0,
                    "refreshHz": 60.0,
                    "supportedCaptureFrameRates": DEFAULT_CAPTURE_FRAME_RATES
                }
            ],
            "windows": [
                {
                    "id": 101,
                    "title": "Desktop",
                    "appName": "System",
                    "width": 1280,
                    "height": 720,
                    "isOnScreen": true,
                    "pixelScale": 1.0,
                    "refreshHz": 60.0,
                    "supportedCaptureFrameRates": DEFAULT_CAPTURE_FRAME_RATES
                }
            ]
        }),
    )
}
