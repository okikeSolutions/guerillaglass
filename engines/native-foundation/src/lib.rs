use protocol_rust::{
    decode_request_line, encode_response_line, failure, success, CaptureClock, EngineMethod,
    EngineRequest, EngineResponse, ProtocolErrorCode, RunningDuration, PROTOCOL_VERSION,
};
use serde_json::{json, Value};
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

pub const ENGINE_VERSION: &str = "0.4.0-native-foundation";
pub const ENGINE_PHASE: &str = "foundation";
const MAX_RECENT_PROJECTS: usize = 20;
const DEFAULT_RECENTS_LIMIT: usize = 10;

pub struct EngineRuntimeConfig {
    pub platform: &'static str,
    pub recents_index_path: PathBuf,
}

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
    fn new(recents_index_path: PathBuf) -> Self {
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

fn handle_request(platform: &str, state: &mut State, request: &EngineRequest) -> EngineResponse {
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
                "platform": platform,
            }),
        ),
        EngineMethod::EngineCapabilities => success(
            &request.id,
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

pub fn run_engine(config: EngineRuntimeConfig) {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut state = State::new(config.recents_index_path);

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

        let response = handle_request(config.platform, &mut state, &request);
        write_response(&mut stdout, response);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        handle_request, is_valid_recent_project_item, load_recent_projects, record_recent_project,
        save_recent_projects, State, MAX_RECENT_PROJECTS,
    };
    use protocol_rust::{EngineRequest, EngineResponse, ProtocolErrorCode};
    use serde_json::{json, Value};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> PathBuf {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "guerillaglass-native-foundation-{label}-{}-{now}",
            std::process::id()
        ))
    }

    fn with_state<T>(label: &str, callback: impl FnOnce(&mut State, &Path) -> T) -> T {
        let root = test_root(label);
        fs::create_dir_all(&root).expect("create test root");
        let recents_path = root.join("Library").join("library.native.json");
        let mut state = State::new(recents_path);
        let result = callback(&mut state, &root);
        let _ = fs::remove_dir_all(root);
        result
    }

    fn request(id: &str, method: &str, params: Value) -> EngineRequest {
        EngineRequest {
            id: id.to_string(),
            method: method.to_string(),
            params,
        }
    }

    fn expect_success(response: EngineResponse) -> Value {
        match response {
            EngineResponse::Success(success) => success.result,
            EngineResponse::Error(error) => panic!(
                "expected success response, got error: {:?}: {}",
                error.error.code, error.error.message
            ),
        }
    }

    fn expect_error(response: EngineResponse, code: ProtocolErrorCode) -> String {
        match response {
            EngineResponse::Success(success) => {
                panic!("expected error response, got success: {:?}", success.result)
            }
            EngineResponse::Error(error) => {
                assert_eq!(error.error.code, code);
                error.error.message
            }
        }
    }

    #[test]
    fn returns_unsupported_method_for_unknown_method() {
        with_state("unsupported-method", |state, _| {
            let response =
                handle_request("linux", state, &request("r1", "nope.unknown", json!({})));
            let message = expect_error(response, ProtocolErrorCode::UnsupportedMethod);
            assert!(message.contains("Unsupported method"));
        });
    }

    #[test]
    fn recording_start_requires_capture_to_be_running() {
        with_state("recording-requires-capture", |state, _| {
            let response =
                handle_request("linux", state, &request("r2", "recording.start", json!({})));
            let message = expect_error(response, ProtocolErrorCode::InvalidParams);
            assert_eq!(message, "Start capture before recording");
        });
    }

    #[test]
    fn capture_and_recording_flow_updates_status_fields() {
        with_state("capture-recording-flow", |state, _| {
            let capture = handle_request(
                "linux",
                state,
                &request("r3", "capture.startDisplay", json!({})),
            );
            let capture_result = expect_success(capture);
            assert_eq!(capture_result["isRunning"], json!(true));
            assert_eq!(
                capture_result["captureMetadata"]["source"],
                json!("display")
            );

            let recording = handle_request(
                "linux",
                state,
                &request("r4", "recording.start", json!({ "trackInputEvents": true })),
            );
            let recording_result = expect_success(recording);
            assert_eq!(recording_result["isRecording"], json!(true));
            assert_eq!(
                recording_result["recordingURL"],
                json!("native://recordings/session.mp4")
            );
            assert_eq!(
                recording_result["eventsURL"],
                json!("native://events/session-events.json")
            );

            let stopped_recording =
                handle_request("linux", state, &request("r5", "recording.stop", json!({})));
            let stopped_recording_result = expect_success(stopped_recording);
            assert_eq!(stopped_recording_result["isRecording"], json!(false));

            let stopped_capture =
                handle_request("linux", state, &request("r6", "capture.stop", json!({})));
            let stopped_capture_result = expect_success(stopped_capture);
            assert_eq!(stopped_capture_result["isRunning"], json!(false));
        });
    }

    #[test]
    fn capture_start_window_uses_default_window_id_when_missing() {
        with_state("capture-window-default-id", |state, _| {
            let response = handle_request(
                "linux",
                state,
                &request("r7", "capture.startWindow", json!({})),
            );
            let result = expect_success(response);
            assert_eq!(result["captureMetadata"]["window"]["id"], json!(101));
            assert_eq!(result["captureMetadata"]["source"], json!("window"));
        });
    }

    #[test]
    fn export_run_requires_output_url() {
        with_state("export-run-missing-output", |state, _| {
            let response = handle_request("linux", state, &request("r8", "export.run", json!({})));
            let message = expect_error(response, ProtocolErrorCode::InvalidParams);
            assert_eq!(message, "outputURL is required");
        });
    }

    #[test]
    fn export_run_writes_output_file() {
        with_state("export-run-write-file", |state, root| {
            let output_url = root.join("exports").join("result.mp4");
            let response = handle_request(
                "linux",
                state,
                &request(
                    "r9",
                    "export.run",
                    json!({ "outputURL": output_url.to_string_lossy() }),
                ),
            );
            let result = expect_success(response);
            assert_eq!(result["outputURL"], json!(output_url.to_string_lossy()));
            assert!(output_url.exists(), "expected export output file to exist");
            let content = fs::read(output_url).expect("read export output");
            assert_eq!(content, b"guerillaglass-native-export");
        });
    }

    #[test]
    fn project_open_and_recents_persist_recent_project_index() {
        with_state("project-open-recents", |state, root| {
            let project_path = root.join("projects").join("demo.ggproject");
            let open = handle_request(
                "linux",
                state,
                &request(
                    "r10",
                    "project.open",
                    json!({ "projectPath": project_path.to_string_lossy() }),
                ),
            );
            let open_result = expect_success(open);
            assert_eq!(
                open_result["projectPath"],
                json!(project_path.to_string_lossy())
            );

            let recents = handle_request(
                "linux",
                state,
                &request("r11", "project.recents", json!({})),
            );
            let recents_result = expect_success(recents);
            let items = recents_result["items"].as_array().expect("recents items");
            assert_eq!(items.len(), 1);
            assert_eq!(
                items[0]["projectPath"],
                json!(project_path.to_string_lossy())
            );
            assert_eq!(items[0]["displayName"], json!("demo"));

            let recents_path = root.join("Library").join("library.native.json");
            assert!(
                recents_path.exists(),
                "expected recents index file to be written"
            );
            let written = fs::read_to_string(recents_path).expect("read recents index");
            assert!(written.contains("demo.ggproject"));
        });
    }

    #[test]
    fn project_save_clamps_auto_zoom_and_writes_snapshot() {
        with_state("project-save-clamps-autoz", |state, root| {
            let project_path = root.join("project-session");
            let save = handle_request(
                "linux",
                state,
                &request(
                    "r12",
                    "project.save",
                    json!({
                        "projectPath": project_path.to_string_lossy(),
                        "autoZoom": {
                            "isEnabled": true,
                            "intensity": 3.0,
                            "minimumKeyframeInterval": 0.0
                        }
                    }),
                ),
            );
            let result = expect_success(save);
            assert_eq!(result["autoZoom"]["isEnabled"], json!(true));
            assert_eq!(result["autoZoom"]["intensity"], json!(1.0));
            assert_eq!(result["autoZoom"]["minimumKeyframeInterval"], json!(0.0001));

            let snapshot = project_path.join("project.native.json");
            assert!(snapshot.exists(), "expected project snapshot to be written");
            let payload: Value =
                serde_json::from_str(&fs::read_to_string(snapshot).expect("read project snapshot"))
                    .expect("parse project snapshot");
            assert_eq!(
                payload["projectPath"],
                json!(project_path.to_string_lossy())
            );
            assert_eq!(payload["autoZoom"]["intensity"], json!(1.0));
        });
    }

    #[test]
    fn project_recents_deduplicates_and_truncates_to_maximum_size() {
        with_state("project-recents-dedupe-truncate", |state, root| {
            let mut selected_path = String::new();
            for index in 0..(MAX_RECENT_PROJECTS + 5) {
                let path = root
                    .join("projects")
                    .join(format!("item-{index}.ggproject"));
                let path_string = path.to_string_lossy().to_string();
                if index == 4 {
                    selected_path = path_string.clone();
                }
                let response = handle_request(
                    "linux",
                    state,
                    &request("r13", "project.open", json!({ "projectPath": path_string })),
                );
                let _ = expect_success(response);
            }

            let dedupe = handle_request(
                "linux",
                state,
                &request(
                    "r14",
                    "project.open",
                    json!({ "projectPath": selected_path.clone() }),
                ),
            );
            let _ = expect_success(dedupe);

            assert_eq!(state.recent_projects.len(), MAX_RECENT_PROJECTS);
            assert_eq!(
                state.recent_projects[0]["projectPath"],
                json!(selected_path)
            );

            let recents = handle_request(
                "linux",
                state,
                &request("r15", "project.recents", json!({ "limit": 200 })),
            );
            let recents_result = expect_success(recents);
            let items = recents_result["items"].as_array().expect("recents items");
            assert_eq!(items.len(), MAX_RECENT_PROJECTS);
        });
    }

    #[test]
    fn load_recent_projects_ignores_invalid_payload_and_invalid_items() {
        let root = test_root("load-recents-filter");
        fs::create_dir_all(&root).expect("create test root");
        let recents_path = root.join("Library").join("library.native.json");
        let parent = recents_path.parent().expect("recents parent");
        fs::create_dir_all(parent).expect("create recents parent");

        fs::write(&recents_path, "not json").expect("write malformed index");
        assert!(load_recent_projects(&recents_path).is_empty());

        let mut items = Vec::new();
        for index in 0..(MAX_RECENT_PROJECTS + 2) {
            items.push(json!({
                "projectPath": format!("/tmp/demo-{index}.ggproject"),
                "displayName": format!("demo-{index}"),
                "lastOpenedAt": "2026-02-21T00:00:00Z"
            }));
        }
        items.push(json!({
            "projectPath": "/tmp/invalid.ggproject",
            "displayName": "",
            "lastOpenedAt": "2026-02-21T00:00:00Z"
        }));

        fs::write(&recents_path, json!({ "items": items }).to_string()).expect("write recents");
        let loaded = load_recent_projects(&recents_path);
        assert_eq!(loaded.len(), MAX_RECENT_PROJECTS);
        assert!(loaded.iter().all(is_valid_recent_project_item));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn save_and_record_helpers_write_expected_item_shape() {
        with_state("save-record-helpers", |state, root| {
            let recents_path = root.join("Library").join("library.native.json");
            save_recent_projects(
                &recents_path,
                &[json!({
                    "projectPath": "/tmp/example.ggproject",
                    "displayName": "example",
                    "lastOpenedAt": "2026-02-21T00:00:00Z"
                })],
            );
            let loaded = load_recent_projects(&recents_path);
            assert_eq!(loaded.len(), 1);

            record_recent_project(state, "/tmp/project-a.ggproject");
            assert_eq!(state.recent_projects.len(), 1);
            assert_eq!(state.recent_projects[0]["displayName"], json!("project-a"));
            assert!(is_valid_recent_project_item(&state.recent_projects[0]));
        });
    }
}
