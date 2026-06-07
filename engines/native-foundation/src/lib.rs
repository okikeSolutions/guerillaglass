use std::path::PathBuf;

mod agent;
mod capture;
mod export;
mod handlers;
mod params;
mod permissions;
mod project;
mod sources;
mod state;
mod system;
mod transport;

pub(crate) use handlers::handle_request;
#[cfg(test)]
pub(crate) use state::record_recent_project;
pub(crate) use state::State;

/// Native foundation engine version identifier.
pub const ENGINE_VERSION: &str = "0.4.0-native-foundation";
/// Native foundation phase reported in capability responses.
pub const ENGINE_PHASE: &str = "foundation";
pub(crate) const DEFAULT_RECENTS_LIMIT: usize = 10;
pub(crate) const PREFLIGHT_TOKEN_TTL_SECONDS: i64 = 60;
pub(crate) const DEFAULT_CAPTURE_FRAME_RATES: [u64; 3] = [24, 30, 60];
pub(crate) const MAX_SOCKET_FRAME_BYTES: usize = 1024 * 1024;

/// Runtime configuration for the native foundation engine loop.
pub struct EngineRuntimeConfig {
    /// Platform identifier returned in capability and ping payloads.
    pub platform: &'static str,
    /// Path to persisted recents index used by project methods.
    pub recents_index_path: PathBuf,
}

pub fn run_engine(config: EngineRuntimeConfig) {
    transport::run_engine(config);
}

#[cfg(test)]
mod tests {
    use super::{handle_request, record_recent_project, State};
    use crate::state::{
        is_valid_recent_project_item, load_recent_projects, save_recent_projects,
        MAX_RECENT_PROJECTS,
    };
    use crate::transport::read_bounded_line;
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
            message_type: "request".to_string(),
            id: id.to_string().into(),
            method: method.to_string(),
            params,
            auth_token: None,
        }
    }

    fn with_force_override<T>(callback: impl FnOnce() -> T) -> T {
        let key = "GG_AGENT_ALLOW_FORCE";
        let previous = std::env::var_os(key);
        // SAFETY: test-only scoped environment override for deterministic fixtures.
        unsafe { std::env::set_var(key, "1") };
        let result = callback();
        match previous {
            Some(value) => {
                // SAFETY: restoring prior process env state after test callback.
                unsafe { std::env::set_var(key, value) };
            }
            None => {
                // SAFETY: restoring prior process env state after test callback.
                unsafe { std::env::remove_var(key) };
            }
        }
        result
    }

    fn write_imported_transcript(root: &Path) -> String {
        let transcript_path = root.join("analysis").join("imported-transcript.json");
        fs::create_dir_all(
            transcript_path
                .parent()
                .expect("imported transcript parent directory"),
        )
        .expect("create transcript directory");
        fs::write(
            &transcript_path,
            json!({
                "segments": [
                    { "startSeconds": 0.0, "endSeconds": 2.0, "text": "Hook action payoff takeaway" }
                ],
                "words": [
                    { "word": "Hook", "startSeconds": 0.0, "endSeconds": 0.5 },
                    { "word": "action", "startSeconds": 0.5, "endSeconds": 1.0 },
                    { "word": "payoff", "startSeconds": 1.0, "endSeconds": 1.5 },
                    { "word": "takeaway", "startSeconds": 1.5, "endSeconds": 2.0 }
                ]
            })
            .to_string(),
        )
        .expect("write imported transcript");
        transcript_path.to_string_lossy().to_string()
    }

    fn write_hook_only_transcript(root: &Path) -> String {
        let transcript_path = root
            .join("analysis")
            .join("imported-transcript-hook-only.json");
        fs::create_dir_all(
            transcript_path
                .parent()
                .expect("imported transcript parent directory"),
        )
        .expect("create transcript directory");
        fs::write(
            &transcript_path,
            json!({
                "segments": [
                    { "startSeconds": 0.0, "endSeconds": 1.0, "text": "Hook intro opening" }
                ],
                "words": [
                    { "word": "Hook", "startSeconds": 0.0, "endSeconds": 0.3 },
                    { "word": "intro", "startSeconds": 0.3, "endSeconds": 0.6 },
                    { "word": "opening", "startSeconds": 0.6, "endSeconds": 1.0 }
                ]
            })
            .to_string(),
        )
        .expect("write imported transcript");
        transcript_path.to_string_lossy().to_string()
    }

    fn expect_success(response: EngineResponse) -> Value {
        match response {
            EngineResponse::Success { result, .. } => result,
            EngineResponse::Error { error, .. } => panic!(
                "expected success response, got error: {:?}: {}",
                error.code, error.message
            ),
            EngineResponse::Chunk { values, .. } => {
                panic!("expected success response, got chunk: {values:?}")
            }
        }
    }

    fn expect_error(response: EngineResponse, code: ProtocolErrorCode) -> String {
        match response {
            EngineResponse::Success { result, .. } => {
                panic!("expected error response, got success: {:?}", result)
            }
            EngineResponse::Error { error, .. } => {
                assert_eq!(error.code, code);
                error.message
            }
            EngineResponse::Chunk { values, .. } => {
                panic!("expected error response, got chunk: {values:?}")
            }
        }
    }

    #[test]
    fn bounded_line_rejects_oversized_frame() {
        let mut input = std::io::Cursor::new(vec![b'a'; 8]);
        let error = read_bounded_line(&mut input, 4).expect_err("oversized frame should fail");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
    }

    #[test]
    fn bounded_line_rejects_malformed_utf8() {
        let mut input = std::io::Cursor::new(vec![0xff, b'\n']);
        let error = read_bounded_line(&mut input, 16).expect_err("invalid utf8 should fail");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
    }

    fn ready_preflight_token(state: &mut State, params: Value) -> String {
        let response = handle_request("linux", state, &request("pf", "agent.preflight", params));
        let result = expect_success(response);
        result
            .get("preflightToken")
            .and_then(Value::as_str)
            .map(String::from)
            .expect("expected ready preflight token")
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
                capture_result["captureSessionId"],
                json!("capture-session-1")
            );
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
            assert_eq!(stopped_capture_result["captureSessionId"], Value::Null);
        });
    }

    #[test]
    fn capture_session_id_changes_across_capture_restarts() {
        with_state("capture-session-ids", |state, _| {
            let first_capture = handle_request(
                "linux",
                state,
                &request("r3", "capture.startDisplay", json!({})),
            );
            let first_capture_result = expect_success(first_capture);
            assert_eq!(
                first_capture_result["captureSessionId"],
                json!("capture-session-1")
            );

            let _ = handle_request("linux", state, &request("r4", "capture.stop", json!({})));

            let second_capture = handle_request(
                "linux",
                state,
                &request("r5", "capture.startDisplay", json!({})),
            );
            let second_capture_result = expect_success(second_capture);
            assert_eq!(
                second_capture_result["captureSessionId"],
                json!("capture-session-2")
            );
        });
    }

    #[test]
    fn sources_list_includes_pixel_scale_for_displays_and_windows() {
        with_state("sources-list-pixel-scale", |state, _| {
            let response =
                handle_request("linux", state, &request("r3a", "sources.list", json!({})));
            let result = expect_success(response);
            let displays = result["displays"].as_array().expect("displays");
            let windows = result["windows"].as_array().expect("windows");

            assert_eq!(displays[0]["pixelScale"], json!(1.0));
            assert_eq!(windows[0]["pixelScale"], json!(1.0));
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
    fn capture_rejects_unsupported_high_frame_rate() {
        with_state("capture-unsupported-high-fps", |state, _| {
            let response = handle_request(
                "linux",
                state,
                &request("r8", "capture.startDisplay", json!({ "captureFps": 120 })),
            );
            let message = expect_error(response, ProtocolErrorCode::InvalidParams);
            assert!(message.contains("Supported values: 24, 30, 60"));
        });
    }

    #[test]
    fn export_run_requires_output_url() {
        with_state("export-run-missing-output", |state, _| {
            let response = handle_request("linux", state, &request("r9", "export.run", json!({})));
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
                    "r10",
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
    fn agent_run_requires_project_and_recording() {
        with_state("agent-run-requires-project-recording", |state, _| {
            let response = handle_request("linux", state, &request("r13", "agent.run", json!({})));
            let message = expect_error(response, ProtocolErrorCode::InvalidParams);
            assert!(message.contains("preflightToken is required"));
        });
    }

    #[test]
    fn agent_apply_enforces_confirmation_and_qa_gate() {
        with_force_override(|| {
            with_state("agent-apply-gates", |state, root| {
                state.project_path = Some(root.join("project").to_string_lossy().to_string());
                state.recording_url = Some("native://recordings/session.mp4".to_string());
                let imported_transcript_path = write_imported_transcript(root);
                let blocked_transcript_path = write_hook_only_transcript(root);
                let successful_preflight_token = ready_preflight_token(
                    state,
                    json!({
                        "transcriptionProvider": "imported_transcript",
                        "importedTranscriptPath": imported_transcript_path,
                    }),
                );

                let successful_run = handle_request(
                    "linux",
                    state,
                    &request(
                        "r14",
                        "agent.run",
                        json!({
                            "preflightToken": successful_preflight_token,
                            "transcriptionProvider": "imported_transcript",
                            "importedTranscriptPath": imported_transcript_path,
                        }),
                    ),
                );
                let successful_result = expect_success(successful_run);
                let successful_job_id = successful_result["jobId"]
                    .as_str()
                    .expect("successful run jobId");

                let confirmation_required = handle_request(
                    "linux",
                    state,
                    &request("r15", "agent.apply", json!({ "jobId": successful_job_id })),
                );
                let confirmation_message =
                    expect_error(confirmation_required, ProtocolErrorCode::NeedsConfirmation);
                assert!(confirmation_message.contains("Unsaved project changes"));

                let apply_success = handle_request(
                    "linux",
                    state,
                    &request(
                        "r16",
                        "agent.apply",
                        json!({ "jobId": successful_job_id, "destructiveIntent": true }),
                    ),
                );
                let apply_success_result = expect_success(apply_success);
                assert_eq!(apply_success_result["success"], json!(true));

                let blocked_preflight_token = ready_preflight_token(
                    state,
                    json!({
                        "transcriptionProvider": "imported_transcript",
                        "importedTranscriptPath": blocked_transcript_path,
                    }),
                );
                let blocked_run = handle_request(
                    "linux",
                    state,
                    &request(
                        "r17",
                        "agent.run",
                        json!({
                            "preflightToken": blocked_preflight_token,
                            "transcriptionProvider": "imported_transcript",
                            "importedTranscriptPath": blocked_transcript_path,
                        }),
                    ),
                );
                let blocked_result = expect_success(blocked_run);
                let blocked_job_id = blocked_result["jobId"].as_str().expect("blocked run jobId");
                let blocked_status = handle_request(
                    "linux",
                    state,
                    &request(
                        "r17_status",
                        "agent.status",
                        json!({ "jobId": blocked_job_id }),
                    ),
                );
                let blocked_status_result = expect_success(blocked_status);
                assert_eq!(
                    blocked_status_result["blockingReason"],
                    json!("weak_narrative_structure")
                );
                let blocked_apply = handle_request(
                    "linux",
                    state,
                    &request(
                        "r18",
                        "agent.apply",
                        json!({ "jobId": blocked_job_id, "destructiveIntent": true }),
                    ),
                );
                let blocked_message = expect_error(blocked_apply, ProtocolErrorCode::QaFailed);
                assert!(blocked_message.contains("Narrative QA failed"));
            })
        });
    }

    #[test]
    fn export_run_cut_plan_requires_passing_qa() {
        with_force_override(|| {
            with_state("export-run-cut-plan", |state, root| {
                state.project_path = Some(root.join("project").to_string_lossy().to_string());
                state.recording_url = Some("native://recordings/session.mp4".to_string());
                let imported_transcript_path = write_imported_transcript(root);
                let blocked_transcript_path = write_hook_only_transcript(root);
                let successful_preflight_token = ready_preflight_token(
                    state,
                    json!({
                        "transcriptionProvider": "imported_transcript",
                        "importedTranscriptPath": imported_transcript_path,
                    }),
                );

                let successful_run = handle_request(
                    "linux",
                    state,
                    &request(
                        "r19",
                        "agent.run",
                        json!({
                            "preflightToken": successful_preflight_token,
                            "transcriptionProvider": "imported_transcript",
                            "importedTranscriptPath": imported_transcript_path,
                        }),
                    ),
                );
                let successful_result = expect_success(successful_run);
                let successful_job_id = successful_result["jobId"]
                    .as_str()
                    .expect("successful run jobId");

                let output_url = root.join("exports").join("cut-plan.mp4");
                let export_response = handle_request(
                    "linux",
                    state,
                    &request(
                        "r20",
                        "export.runCutPlan",
                        json!({
                            "jobId": successful_job_id,
                            "presetId": "h264-1080p-30",
                            "outputURL": output_url.to_string_lossy(),
                        }),
                    ),
                );
                let export_result = expect_success(export_response);
                assert_eq!(export_result["appliedSegments"], json!(4));
                assert!(
                    output_url.exists(),
                    "expected cut-plan output file to be written"
                );

                let blocked_preflight_token = ready_preflight_token(
                    state,
                    json!({
                        "transcriptionProvider": "imported_transcript",
                        "importedTranscriptPath": blocked_transcript_path,
                    }),
                );
                let blocked_run = handle_request(
                    "linux",
                    state,
                    &request(
                        "r21",
                        "agent.run",
                        json!({
                            "preflightToken": blocked_preflight_token,
                            "transcriptionProvider": "imported_transcript",
                            "importedTranscriptPath": blocked_transcript_path,
                        }),
                    ),
                );
                let blocked_result = expect_success(blocked_run);
                let blocked_job_id = blocked_result["jobId"].as_str().expect("blocked run jobId");
                let blocked_export = handle_request(
                    "linux",
                    state,
                    &request(
                        "r22",
                        "export.runCutPlan",
                        json!({
                            "jobId": blocked_job_id,
                            "presetId": "h264-1080p-30",
                            "outputURL": output_url.to_string_lossy(),
                        }),
                    ),
                );
                let blocked_message = expect_error(blocked_export, ProtocolErrorCode::QaFailed);
                assert!(blocked_message.contains("Narrative QA failed"));
            })
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
