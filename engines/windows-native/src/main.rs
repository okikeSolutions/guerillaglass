use serde_json::{json, Value};
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::time::Instant;

const PLATFORM: &str = "windows";

struct State {
    is_running: bool,
    is_recording: bool,
    recording_started_at: Option<Instant>,
    recording_duration_seconds: f64,
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
            is_running: false,
            is_recording: false,
            recording_started_at: None,
            recording_duration_seconds: 0.0,
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
        let live = if let Some(started) = self.recording_started_at {
            started.elapsed().as_secs_f64()
        } else {
            0.0
        };
        self.recording_duration_seconds + live
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

fn success(id: &str, result: Value) -> Value {
    json!({
        "id": id,
        "ok": true,
        "result": result,
    })
}

fn failure(id: &str, code: &str, message: &str) -> Value {
    json!({
        "id": id,
        "ok": false,
        "error": {
            "code": code,
            "message": message,
        },
    })
}

fn get_string(params: &Value, key: &str) -> Option<String> {
    params.get(key).and_then(Value::as_str).map(String::from)
}

fn get_f64(params: &Value, key: &str) -> Option<f64> {
    params.get(key).and_then(Value::as_f64)
}

fn handle_request(state: &mut State, request: &Value) -> Value {
    let id = request
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let method = match request.get("method").and_then(Value::as_str) {
        Some(value) => value,
        None => return failure(id, "invalid_request", "Missing method"),
    };
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

    match method {
        "system.ping" => success(
            id,
            json!({
                "app": "guerillaglass",
                "engineVersion": "0.3.0-native-foundation",
                "protocolVersion": "2",
                "platform": PLATFORM,
            }),
        ),
        "permissions.get" => success(
            id,
            json!({
                "screenRecordingGranted": true,
                "microphoneGranted": true,
                "inputMonitoring": "authorized",
            }),
        ),
        "permissions.requestScreenRecording"
        | "permissions.requestMicrophone"
        | "permissions.requestInputMonitoring"
        | "permissions.openInputMonitoringSettings" => success(
            id,
            json!({
                "success": true,
                "message": "Permission flow wiring is active. Native policy integration pending.",
            }),
        ),
        "sources.list" => {
            success(
                id,
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
        "capture.startDisplay" => {
            state.is_running = true;
            state.capture_metadata = Some(json!({
                "source": "display",
                "contentRect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
                "pixelScale": 1,
            }));
            success(id, state.capture_status())
        }
        "capture.startWindow" => {
            state.is_running = true;
            state.capture_metadata = Some(json!({
                "source": "window",
                "contentRect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
                "pixelScale": 1,
            }));
            success(id, state.capture_status())
        }
        "capture.stop" => {
            if state.is_recording {
                if let Some(started) = state.recording_started_at {
                    state.recording_duration_seconds += started.elapsed().as_secs_f64();
                }
            }
            state.recording_started_at = None;
            state.is_recording = false;
            state.is_running = false;
            success(id, state.capture_status())
        }
        "recording.start" => {
            if !state.is_running {
                return failure(id, "invalid_params", "Start capture before recording");
            }
            state.is_recording = true;
            state.recording_started_at = Some(Instant::now());
            state.recording_url = Some("native://recordings/session.mp4".to_string());
            if params
                .get("trackInputEvents")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                state.events_url = Some("native://events/session-events.json".to_string());
            }
            success(id, state.capture_status())
        }
        "recording.stop" => {
            if state.is_recording {
                if let Some(started) = state.recording_started_at {
                    state.recording_duration_seconds += started.elapsed().as_secs_f64();
                }
            }
            state.recording_started_at = None;
            state.is_recording = false;
            success(id, state.capture_status())
        }
        "capture.status" => success(id, state.capture_status()),
        "export.info" => success(
            id,
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
        "export.run" => {
            let output_url = match get_string(&params, "outputURL") {
                Some(value) => value,
                None => return failure(id, "invalid_params", "outputURL is required"),
            };

            let output_path = PathBuf::from(&output_url);
            if let Some(parent) = output_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&output_path, b"guerillaglass-native-export");

            success(id, json!({ "outputURL": output_url }))
        }
        "project.current" => success(id, state.project_state()),
        "project.open" => {
            let project_path = match get_string(&params, "projectPath") {
                Some(value) => value,
                None => return failure(id, "invalid_params", "projectPath is required"),
            };
            state.project_path = Some(project_path);
            success(id, state.project_state())
        }
        "project.save" => {
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

            success(id, state.project_state())
        }
        _ => failure(id, "unsupported_method", &format!("Unsupported method: {method}")),
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

        let request: Value = match serde_json::from_str(trimmed) {
            Ok(value) => value,
            Err(_) => {
                let fallback = failure("unknown", "invalid_request", "Invalid JSON request");
                let _ = writeln!(stdout, "{}", fallback);
                let _ = stdout.flush();
                continue;
            }
        };

        let response = handle_request(&mut state, &request);
        let _ = writeln!(stdout, "{}", response);
        let _ = stdout.flush();
    }
}
