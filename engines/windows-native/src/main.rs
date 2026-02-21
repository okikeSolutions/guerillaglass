use protocol_rust::{
    decode_request_line, encode_response_line, failure, success, CaptureClock, EngineMethod,
    EngineRequest, EngineResponse, ProtocolErrorCode, RunningDuration, PROTOCOL_VERSION,
};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

const PLATFORM: &str = "windows";
const ENGINE_VERSION: &str = "0.4.0-native-foundation";
const ENGINE_PHASE: &str = "foundation";
const MAX_RECENT_PROJECTS: usize = 20;
const DEFAULT_RECENTS_LIMIT: usize = 10;

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
    recent_projects: Vec<Value>,
    recents_index_path: PathBuf,
}

impl State {
    fn new() -> Self {
        let recents_index_path = default_recents_index_path();
        let recent_projects = load_recent_projects(&recents_index_path);
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
            recent_projects,
            recents_index_path,
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
            "captureMetadata": self.capture_metadata,
            "lastError": self.last_error,
            "eventsURL": self.events_url,
            "telemetry": {
                "totalFrames": 0,
                "droppedFrames": 0,
                "droppedFramePercent": 0.0,
                "audioLevelDbfs": Value::Null,
                "health": "good",
                "healthReason": Value::Null,
            },
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

fn default_recents_index_path() -> PathBuf {
    if let Some(app_data) = env::var_os("APPDATA") {
        return PathBuf::from(app_data)
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    if let Some(user_profile) = env::var_os("USERPROFILE") {
        return PathBuf::from(user_profile)
            .join("AppData")
            .join("Roaming")
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    PathBuf::from("guerillaglass-library.native.json")
}

fn now_iso8601() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn load_recent_projects(index_path: &Path) -> Vec<Value> {
    let data = match fs::read_to_string(index_path) {
        Ok(data) => data,
        Err(_) => return Vec::new(),
    };
    let parsed = match serde_json::from_str::<Value>(&data) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };
    parsed
        .get("items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| is_valid_recent_project_item(item))
                .take(MAX_RECENT_PROJECTS)
                .cloned()
                .collect::<Vec<Value>>()
        })
        .unwrap_or_default()
}

fn save_recent_projects(index_path: &Path, items: &[Value]) {
    if let Some(parent) = index_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(index_path, json!({ "items": items }).to_string());
}

fn is_valid_recent_project_item(item: &Value) -> bool {
    let project_path = item
        .get("projectPath")
        .and_then(Value::as_str)
        .unwrap_or("");
    let display_name = item
        .get("displayName")
        .and_then(Value::as_str)
        .unwrap_or("");
    let last_opened_at = item
        .get("lastOpenedAt")
        .and_then(Value::as_str)
        .unwrap_or("");
    !project_path.is_empty() && !display_name.is_empty() && !last_opened_at.is_empty()
}

fn record_recent_project(state: &mut State, project_path: &str) {
    let display_name = PathBuf::from(project_path)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or(project_path)
        .to_string();
    let item = json!({
        "projectPath": project_path,
        "displayName": display_name,
        "lastOpenedAt": now_iso8601(),
    });
    state.recent_projects.retain(|existing| {
        existing.get("projectPath") != Some(&Value::String(project_path.to_string()))
    });
    state.recent_projects.insert(0, item);
    if state.recent_projects.len() > MAX_RECENT_PROJECTS {
        state.recent_projects.truncate(MAX_RECENT_PROJECTS);
    }
    save_recent_projects(&state.recents_index_path, &state.recent_projects);
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
        EngineMethod::SourcesList => success(
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
        ),
        EngineMethod::CaptureStartDisplay => {
            state.is_running = true;
            state.capture_metadata = Some(json!({
                "window": Value::Null,
                "source": "display",
                "contentRect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
                "pixelScale": 1,
            }));
            success(&request.id, state.capture_status())
        }
        EngineMethod::CaptureStartWindow => {
            let window_id = params
                .get("windowId")
                .and_then(Value::as_u64)
                .unwrap_or(101);
            state.is_running = true;
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
            let output_url = match get_string(params, "outputURL") {
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
            let project_path = match get_string(params, "projectPath") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "projectPath is required",
                    )
                }
            };
            state.project_path = Some(project_path.clone());
            record_recent_project(state, &project_path);
            success(&request.id, state.project_state())
        }
        EngineMethod::ProjectSave => {
            if let Some(project_path) = get_string(params, "projectPath") {
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
                state.auto_zoom_min_keyframe_interval =
                    get_f64(auto_zoom, "minimumKeyframeInterval")
                        .unwrap_or(state.auto_zoom_min_keyframe_interval)
                        .max(0.0001);
            }

            if let Some(project_path) = state.project_path.clone() {
                let directory = PathBuf::from(&project_path);
                let _ = fs::create_dir_all(&directory);
                let snapshot_path = directory.join("project.native.json");
                let _ = fs::write(snapshot_path, state.project_state().to_string());
                record_recent_project(state, &project_path);
            }

            success(&request.id, state.project_state())
        }
        EngineMethod::ProjectRecents => {
            let limit = params
                .get("limit")
                .and_then(Value::as_u64)
                .map(|value| value.min(100) as usize)
                .unwrap_or(DEFAULT_RECENTS_LIMIT);
            let items = state
                .recent_projects
                .iter()
                .take(limit)
                .cloned()
                .collect::<Vec<Value>>();
            success(&request.id, json!({ "items": items }))
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
