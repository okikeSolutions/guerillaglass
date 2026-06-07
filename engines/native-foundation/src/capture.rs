use crate::params::{CaptureStartParams, RecordingStartParams};
use crate::state::State;
use crate::DEFAULT_CAPTURE_FRAME_RATES;
use protocol_rust::{failure, success, EngineResponse, JsonRpcId, ProtocolErrorCode};
use serde_json::{json, Value};

fn decode_params<T>(params: &Value) -> T
where
    T: for<'de> serde::Deserialize<'de> + Default,
{
    serde_json::from_value(params.clone()).unwrap_or_default()
}

fn validate_capture_fps(id: &JsonRpcId, capture_fps: u64) -> Result<(), EngineResponse> {
    if DEFAULT_CAPTURE_FRAME_RATES.contains(&capture_fps) {
        return Ok(());
    }
    Err(failure(
        id,
        ProtocolErrorCode::InvalidParams,
        format!(
            "captureFps {capture_fps} is unsupported for the current source (refresh rate: 60.00 Hz). Supported values: 24, 30, 60"
        ),
    ))
}

pub(crate) fn start_display(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let capture_params: CaptureStartParams = decode_params(params);
    let capture_fps = capture_params.capture_fps.unwrap_or(30);
    if let Err(response) = validate_capture_fps(id, capture_fps) {
        return response;
    }
    state.is_running = true;
    state.begin_capture_session();
    state.capture_metadata = Some(json!({
        "window": Value::Null,
        "source": "display",
        "contentRect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
        "pixelScale": 1,
    }));
    success(id, state.capture_status())
}

pub(crate) fn start_current_window(
    id: &JsonRpcId,
    state: &mut State,
    params: &Value,
) -> EngineResponse {
    let capture_params: CaptureStartParams = decode_params(params);
    let capture_fps = capture_params.capture_fps.unwrap_or(30);
    if let Err(response) = validate_capture_fps(id, capture_fps) {
        return response;
    }
    state.is_running = true;
    state.begin_capture_session();
    state.capture_metadata = Some(json!({
        "window": {
            "id": 101,
            "title": "Desktop",
            "appName": "System",
        },
        "source": "window",
        "contentRect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
        "pixelScale": 1,
    }));
    success(id, state.capture_status())
}

pub(crate) fn start_window(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let capture_params: CaptureStartParams = decode_params(params);
    let capture_fps = capture_params.capture_fps.unwrap_or(30);
    if let Err(response) = validate_capture_fps(id, capture_fps) {
        return response;
    }
    let window_id = capture_params.window_id.unwrap_or(101);
    state.is_running = true;
    state.begin_capture_session();
    state.capture_metadata = Some(json!({
        "window": {
            "id": window_id,
            "title": "Desktop",
            "appName": "System",
        },
        "source": "window",
        "contentRect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
        "pixelScale": 1,
    }));
    success(id, state.capture_status())
}

pub(crate) fn stop_capture(id: &JsonRpcId, state: &mut State) -> EngineResponse {
    state.recording_duration.stop(&state.clock);
    state.is_recording = false;
    state.is_running = false;
    state.capture_session_id = None;
    success(id, state.capture_status())
}

pub(crate) fn start_recording(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let recording_params: RecordingStartParams = decode_params(params);
    if !state.is_running {
        return failure(
            id,
            ProtocolErrorCode::InvalidParams,
            "Start capture before recording",
        );
    }
    state.is_recording = true;
    state.recording_duration.start(&state.clock);
    state.recording_url = Some("native://recordings/session.mp4".to_string());
    if recording_params.track_input_events.unwrap_or(false) {
        state.events_url = Some("native://events/session-events.json".to_string());
    }
    success(id, state.capture_status())
}

pub(crate) fn stop_recording(id: &JsonRpcId, state: &mut State) -> EngineResponse {
    state.recording_duration.stop(&state.clock);
    state.is_recording = false;
    state.unsaved_changes = true;
    success(id, state.capture_status())
}

pub(crate) fn status(id: &JsonRpcId, state: &State) -> EngineResponse {
    success(id, state.capture_status())
}

pub(crate) fn preview_frame(id: &JsonRpcId) -> EngineResponse {
    success(id, json!(null))
}
