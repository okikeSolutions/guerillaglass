use protocol_rust::{
    decode_request_line, encode_response_line, failure, success, CaptureClock, EngineMethod,
    EngineRequest, EngineResponse, ProtocolErrorCode, RunningDuration, PROTOCOL_VERSION,
};
use serde_json::{json, Value};
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

const PLATFORM: &str = "linux";
const ENGINE_VERSION: &str = "0.4.0-native-foundation";
const ENGINE_PHASE: &str = "foundation";

struct State {
    clock: CaptureClock,
    is_running: bool,
    is_recording: bool,
    recording_duration: RunningDuration,
    recording_url: Option<String>,
    events_url: Option<String>,
    last_error: Option<String>,
    project_path: Option<String>,
    auto_zoom_enabled: bool,
    auto_zoom_intensity: f64,
    auto_zoom_min_keyframe_interval: f64,
    capture_metadata: Option<Value>,
}

impl State {
    fn new() -> Self {
        Self {
            clock: CaptureClock::default(),
            is_running: false,
            is_recording: false,
            recording_duration: RunningDuration::default(),
            recording_url: None,
            events_url: None,
            last_error: None,
            project_path: None,
            auto_zoom_enabled: false,
            auto_zoom_intensity: 0.55,
            auto_zoom_min_keyframe_interval: 0.15,
            capture_metadata: None,
        }
    }

    fn current_duration(&self) -> f64 {
        self.recording_duration.current(&self.clock)
    }

    fn capture_status(&self) -> Value {
        json!({
            "isRunning": self.is_running,
            "isRecording": self.is_recording,
            "recordingDurationSeconds": self.current_duration(),
            "recordingURL": self.recording_url,
            "lastError": self.last_error,
            "eventsURL": self.events_url,
        })
    }

    fn project_state(&self) -> Value {
        json!({
            "projectPath": self.project_path,
            "recordingURL": self.recording_url,
            "eventsURL": self.events_url,
            "autoZoom": {
                "isEnabled": self.auto_zoom_enabled,
                "intensity": self.auto_zoom_intensity,
                "minimumKeyframeInterval": self.auto_zoom_min_keyframe_interval,
            },
            "captureMetadata": self.capture_metadata,
        })
    }
}

fn get_string(params: &Value, key: &str) -> Option<String> {
    params.get(key).and_then(Value::as_str).map(String::from)
}

fn get_f64(params: &Value, key: &str) -> Option<f64> {
    params.get(key).and_then(Value::as_f64)
}

fn handle_request(state: &mut State, request: &EngineRequest) -> EngineResponse {
    let Some(method) = request.method_kind() else {
        return failure(
            &request.id,
            ProtocolErrorCode::UnsupportedMethod,
            format!("Unsupported method: {}", request.method),
        );
    };
    let params = &request.params;
    match method {
        EngineMethod::SystemPing => success(
            &request.id,
            json!({
                "app": "guerillaglass",
                "engineVersion": ENGINE_VERSION,
                "protocolVersion": PROTOCOL_VERSION,
                "platform": PLATFORM,
            }),
        ),
        EngineMethod::EngineCapabilities => success(
            &request.id,
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "platform": PLATFORM,
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
                },
                "project": {
                    "openSave": true,
                }
            }),
        ),
        EngineMethod::PermissionsGet => success(
            &request.id,
            json!({
                "screenRecordingGranted": true,
                "microphoneGranted": true,
                "inputMonitoring": "authorized",
            }),
        ),
        EngineMethod::PermissionsRequestScreenRecording
        | EngineMethod::PermissionsRequestMicrophone
        | EngineMethod::PermissionsRequestInputMonitoring
        | EngineMethod::PermissionsOpenInputMonitoringSettings => success(
            &request.id,
            json!({
                "success": true,
                "message": "Permission flow wiring is active. Native policy integration pending.",
            }),
        ),
        EngineMethod::SourcesList => {
            success(
                &request.id,
                json!({
                    "displays": [
                        { "id": 1, "width": 1920, "height": 1080 }
                    ],
                    "windows": [
                        {
                            "id": 101,
                            "title": "Desktop",
                            "appName": "System",
                            "width": 1280,
                            "height": 720,
                            "isOnScreen": true
                        }
                    ]
                }),
            )
        }
        EngineMethod::CaptureStartDisplay => {
            state.is_running = true;
            state.capture_metadata = Some(json!({
                "source": "display",
                "contentRect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
                "pixelScale": 1,
            }));
            success(&request.id, state.capture_status())
        }
        EngineMethod::CaptureStartWindow => {
            state.is_running = true;
            state.capture_metadata = Some(json!({
                "source": "window",
                "contentRect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
                "pixelScale": 1,
            }));
            success(&request.id, state.capture_status())
        }
        EngineMethod::CaptureStop => {
            state.recording_duration.stop(&state.clock);
            state.is_recording = false;
            state.is_running = false;
            success(&request.id, state.capture_status())
        }
        EngineMethod::RecordingStart => {
            if !state.is_running {
                return failure(
                    &request.id,
                    ProtocolErrorCode::InvalidParams,
                    "Start capture before recording",
                );
            }
            state.is_recording = true;
            state.recording_duration.start(&state.clock);
            state.recording_url = Some("native://recordings/session.mp4".to_string());
            if params
                .get("trackInputEvents")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                state.events_url = Some("native://events/session-events.json".to_string());
            }
            success(&request.id, state.capture_status())
        }
        EngineMethod::RecordingStop => {
            state.recording_duration.stop(&state.clock);
            state.is_recording = false;
            success(&request.id, state.capture_status())
        }
        EngineMethod::CaptureStatus => success(&request.id, state.capture_status()),
        EngineMethod::ExportInfo => success(
            &request.id,
            json!({
                "presets": [
                    {
                        "id": "h264-1080p-30",
                        "name": "1080p 30fps",
                        "width": 1920,
                        "height": 1080,
                        "fps": 30,
                        "fileType": "mp4"
                    }
                ]
            }),
        ),
        EngineMethod::ExportRun => {
            let output_url = match get_string(&params, "outputURL") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "outputURL is required",
                    )
                }
            };

            let output_path = PathBuf::from(&output_url);
            if let Some(parent) = output_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&output_path, b"guerillaglass-native-export");

            success(&request.id, json!({ "outputURL": output_url }))
        }
        EngineMethod::ProjectCurrent => success(&request.id, state.project_state()),
        EngineMethod::ProjectOpen => {
            let project_path = match get_string(&params, "projectPath") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "projectPath is required",
                    )
                }
            };
            state.project_path = Some(project_path);
            success(&request.id, state.project_state())
        }
        EngineMethod::ProjectSave => {
            if let Some(project_path) = get_string(&params, "projectPath") {
                state.project_path = Some(project_path);
            }

            if let Some(auto_zoom) = params.get("autoZoom") {
                state.auto_zoom_enabled = auto_zoom
                    .get("isEnabled")
                    .and_then(Value::as_bool)
                    .unwrap_or(state.auto_zoom_enabled);
                state.auto_zoom_intensity = get_f64(auto_zoom, "intensity")
                    .unwrap_or(state.auto_zoom_intensity)
                    .clamp(0.0, 1.0);
                state.auto_zoom_min_keyframe_interval = get_f64(auto_zoom, "minimumKeyframeInterval")
                    .unwrap_or(state.auto_zoom_min_keyframe_interval)
                    .max(0.0001);
            }

            if let Some(project_path) = &state.project_path {
                let directory = PathBuf::from(project_path);
                let _ = fs::create_dir_all(&directory);
                let snapshot_path = directory.join("project.native.json");
                let _ = fs::write(snapshot_path, state.project_state().to_string());
            }

            success(&request.id, state.project_state())
        }
    }
}

fn write_response(stdout: &mut io::Stdout, response: EngineResponse) {
    if let Ok(line) = encode_response_line(&response) {
        let _ = writeln!(stdout, "{line}");
        let _ = stdout.flush();
    }
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut state = State::new();

    for line_result in stdin.lock().lines() {
        let line = match line_result {
            Ok(value) => value,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let request = match decode_request_line(trimmed) {
            Ok(value) => value,
            Err(_) => {
                write_response(
                    &mut stdout,
                    failure(
                        "unknown",
                        ProtocolErrorCode::InvalidRequest,
                        "Invalid JSON request",
                    ),
                );
                continue;
            }
        };

        let response = handle_request(&mut state, &request);
        write_response(&mut stdout, response);
    }
}
