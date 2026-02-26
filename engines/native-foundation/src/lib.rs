use protocol_rust::{
    decode_request_line, encode_response_line, failure, success, CaptureClock, EngineMethod,
    EngineRequest, EngineResponse, ProtocolErrorCode, RunningDuration, PROTOCOL_VERSION,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

/// Native foundation engine version identifier.
pub const ENGINE_VERSION: &str = "0.4.0-native-foundation";
/// Native foundation phase reported in capability responses.
pub const ENGINE_PHASE: &str = "foundation";
const MAX_RECENT_PROJECTS: usize = 20;
const DEFAULT_RECENTS_LIMIT: usize = 10;
const PREFLIGHT_TOKEN_TTL_SECONDS: i64 = 60;

/// Runtime configuration for the native foundation engine loop.
pub struct EngineRuntimeConfig {
    /// Platform identifier returned in capability and ping payloads.
    pub platform: &'static str,
    /// Path to persisted recents index used by project methods.
    pub recents_index_path: PathBuf,
}

#[derive(Clone)]
struct AgentRunState {
    job_id: String,
    status: &'static str,
    runtime_budget_minutes: i64,
    blocking_reason: Option<&'static str>,
    updated_at: String,
    qa_report: Value,
}

#[derive(Clone)]
struct PreflightSession {
    token: String,
    ready: bool,
    runtime_budget_minutes: i64,
    transcription_provider: String,
    imported_transcript_path: String,
    project_path: Option<String>,
    recording_url: Option<String>,
    created_at_unix_seconds: i64,
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
    unsaved_changes: bool,
    agent_runs: HashMap<String, AgentRunState>,
    preflight_sessions: HashMap<String, PreflightSession>,
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
            unsaved_changes: false,
            agent_runs: HashMap::new(),
            preflight_sessions: HashMap::new(),
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
        let latest_run = self
            .agent_runs
            .values()
            .max_by(|left, right| left.updated_at.cmp(&right.updated_at));

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
            "agentAnalysis": {
                "latestJobId": latest_run.map(|run| run.job_id.clone()),
                "latestStatus": latest_run.map(|run| run.status),
                "qaPassed": latest_run.and_then(|run| run.qa_report.get("passed").and_then(Value::as_bool)),
                "updatedAt": latest_run.map(|run| run.updated_at.clone()),
            },
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

fn transcription_provider(params: &Value) -> &'static str {
    match params
        .get("transcriptionProvider")
        .and_then(Value::as_str)
        .unwrap_or("none")
    {
        "imported_transcript" => "imported_transcript",
        _ => "none",
    }
}

fn now_unix_seconds() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

fn imported_transcript_payload(path: &str) -> Option<Value> {
    if path.is_empty() {
        return None;
    }
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&data).ok()
}

fn numeric_time(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64)
}

fn normalized_segment(entry: &Value) -> Option<String> {
    let text = entry
        .get("text")
        .and_then(Value::as_str)?
        .trim()
        .to_string();
    let start = numeric_time(entry.get("startSeconds"))
        .or_else(|| numeric_time(entry.get("start")))
        .or_else(|| numeric_time(entry.get("start_time_seconds")))?;
    let end = numeric_time(entry.get("endSeconds"))
        .or_else(|| numeric_time(entry.get("end")))
        .or_else(|| numeric_time(entry.get("end_time_seconds")))?;
    if text.is_empty() || start < 0.0 || end <= start {
        return None;
    }
    Some(text)
}

fn normalized_word(entry: &Value) -> Option<String> {
    let word = entry
        .get("word")
        .and_then(Value::as_str)?
        .trim()
        .to_string();
    let start = numeric_time(entry.get("startSeconds"))
        .or_else(|| numeric_time(entry.get("start")))
        .or_else(|| numeric_time(entry.get("start_time_seconds")))?;
    let end = numeric_time(entry.get("endSeconds"))
        .or_else(|| numeric_time(entry.get("end")))
        .or_else(|| numeric_time(entry.get("end_time_seconds")))?;
    if word.is_empty() || start < 0.0 || end <= start {
        return None;
    }
    Some(word)
}

fn normalized_imported_transcript(path: &str) -> Option<(Vec<String>, Vec<String>)> {
    let parsed = imported_transcript_payload(path)?;
    let segments = parsed
        .get("segments")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(normalized_segment)
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    let words = parsed
        .get("words")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(normalized_word)
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    if segments.is_empty() && words.is_empty() {
        return None;
    }
    Some((segments, words))
}

fn imported_transcript_is_valid(path: &str) -> bool {
    normalized_imported_transcript(path).is_some()
}

fn transcript_tokens(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(String::from)
        .collect::<Vec<String>>()
}

fn has_any_token(tokens: &[String], candidates: &[&str]) -> bool {
    candidates
        .iter()
        .any(|candidate| tokens.iter().any(|token| token == candidate))
}

fn transcript_coverage(path: &str) -> Option<(Value, bool)> {
    let (segments, words) = normalized_imported_transcript(path)?;
    let text = [segments.join(" "), words.join(" ")].join(" ");
    let tokens = transcript_tokens(&text);
    let coverage = json!({
        "hook": has_any_token(&tokens, &["hook", "intro", "opening"]),
        "action": has_any_token(&tokens, &["action", "step", "steps", "process"]),
        "payoff": has_any_token(&tokens, &["payoff", "result", "outcome"]),
        "takeaway": has_any_token(&tokens, &["takeaway", "lesson", "conclusion"]),
    });
    Some((coverage, !tokens.is_empty()))
}

struct AgentPreflightEvaluation {
    ready: bool,
    blocking_reasons: Vec<&'static str>,
    runtime_budget_minutes: i64,
    provider: String,
    imported_transcript_path: String,
}

fn evaluate_agent_preflight(state: &State, params: &Value) -> AgentPreflightEvaluation {
    let runtime_budget_minutes = params
        .get("runtimeBudgetMinutes")
        .and_then(Value::as_i64)
        .unwrap_or(10);
    let provider = transcription_provider(params).to_string();
    let imported_path = params
        .get("importedTranscriptPath")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let mut blocking_reasons: Vec<&'static str> = Vec::new();

    if !(1..=10).contains(&runtime_budget_minutes) {
        blocking_reasons.push("invalid_runtime_budget");
    }
    if state.project_path.is_none() {
        blocking_reasons.push("missing_project");
    }
    if state.recording_url.is_none() {
        blocking_reasons.push("missing_recording");
    }

    match provider.as_str() {
        "none" => blocking_reasons.push("missing_local_model"),
        "imported_transcript" => {
            if imported_path.is_empty() {
                blocking_reasons.push("missing_imported_transcript");
            } else if !imported_transcript_is_valid(&imported_path) {
                blocking_reasons.push("invalid_imported_transcript");
            }
        }
        _ => blocking_reasons.push("missing_local_model"),
    }

    AgentPreflightEvaluation {
        ready: blocking_reasons.is_empty(),
        blocking_reasons,
        runtime_budget_minutes,
        provider,
        imported_transcript_path: imported_path,
    }
}

fn preflight_token() -> String {
    format!(
        "preflight-{}",
        OffsetDateTime::now_utc().unix_timestamp_nanos()
    )
}

fn agent_preflight(state: &mut State, params: &Value) -> Value {
    let evaluation = evaluate_agent_preflight(state, params);
    let token = if evaluation.ready {
        let token = preflight_token();
        state.preflight_sessions.insert(
            token.clone(),
            PreflightSession {
                token: token.clone(),
                ready: true,
                runtime_budget_minutes: evaluation.runtime_budget_minutes,
                transcription_provider: evaluation.provider.clone(),
                imported_transcript_path: evaluation.imported_transcript_path.clone(),
                project_path: state.project_path.clone(),
                recording_url: state.recording_url.clone(),
                created_at_unix_seconds: now_unix_seconds(),
            },
        );
        Some(token)
    } else {
        None
    };

    json!({
        "ready": evaluation.ready,
        "blockingReasons": evaluation.blocking_reasons,
        "canApplyDestructive": state.unsaved_changes,
        "transcriptionProvider": evaluation.provider,
        "preflightToken": token,
    })
}

fn validate_preflight_token(state: &mut State, token: &str, params: &Value) -> Result<(), String> {
    if token.is_empty() {
        return Err(
            "agent.preflight must be called first. preflightToken is required.".to_string(),
        );
    }

    let session = match state.preflight_sessions.get(token) {
        Some(session) => session.clone(),
        None => {
            return Err(
                "preflightToken is missing or expired. Run agent.preflight again.".to_string(),
            );
        }
    };

    if now_unix_seconds() - session.created_at_unix_seconds > PREFLIGHT_TOKEN_TTL_SECONDS {
        state.preflight_sessions.remove(token);
        return Err("preflightToken expired. Run agent.preflight again.".to_string());
    }

    let evaluation = evaluate_agent_preflight(state, params);
    let matches = session.ready
        && session.token == token
        && session.runtime_budget_minutes == evaluation.runtime_budget_minutes
        && session.transcription_provider == evaluation.provider
        && session.imported_transcript_path == evaluation.imported_transcript_path
        && session.project_path == state.project_path
        && session.recording_url == state.recording_url;
    if !matches {
        state.preflight_sessions.remove(token);
        return Err(
            "preflightToken does not match current run parameters. Run agent.preflight again."
                .to_string(),
        );
    }

    state.preflight_sessions.remove(token);
    Ok(())
}

fn build_agent_run(
    job_id: String,
    runtime_budget_minutes: i64,
    coverage: Value,
    blocking_reason: Option<&'static str>,
) -> AgentRunState {
    let mut missing_beats: Vec<&str> = Vec::new();
    if !coverage
        .get("hook")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        missing_beats.push("hook");
    }
    if !coverage
        .get("action")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        missing_beats.push("action");
    }
    if !coverage
        .get("payoff")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        missing_beats.push("payoff");
    }
    if !coverage
        .get("takeaway")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        missing_beats.push("takeaway");
    }
    let covered_count = 4 - missing_beats.len();
    let passed = missing_beats.is_empty();
    let score = covered_count as f64 / 4.0;

    AgentRunState {
        job_id: job_id.clone(),
        status: if passed { "completed" } else { "blocked" },
        runtime_budget_minutes,
        blocking_reason: if passed { None } else { blocking_reason },
        updated_at: now_iso8601(),
        qa_report: json!({
            "passed": passed,
            "score": score,
            "coverage": coverage,
            "missingBeats": missing_beats,
        }),
    }
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
        ),
        EngineMethod::AgentPreflight => success(&request.id, agent_preflight(state, params)),
        EngineMethod::AgentRun => {
            let token = params
                .get("preflightToken")
                .and_then(Value::as_str)
                .unwrap_or("");
            if let Err(message) = validate_preflight_token(state, token, params) {
                return failure(&request.id, ProtocolErrorCode::InvalidParams, message);
            }

            let runtime_budget_minutes = params
                .get("runtimeBudgetMinutes")
                .and_then(Value::as_i64)
                .unwrap_or(10);
            let force = params
                .get("force")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !(1..=10).contains(&runtime_budget_minutes) {
                return failure(
                    &request.id,
                    ProtocolErrorCode::InvalidParams,
                    "runtimeBudgetMinutes must be between 1 and 10",
                );
            }
            if force && std::env::var("GG_AGENT_ALLOW_FORCE").ok().as_deref() != Some("1") {
                return failure(
                    &request.id,
                    ProtocolErrorCode::InvalidParams,
                    "force is disabled for production runs. Set GG_AGENT_ALLOW_FORCE=1 for local debugging.",
                );
            }

            let job_id = format!(
                "agent-{}-{}",
                state.agent_runs.len() + 1,
                OffsetDateTime::now_utc().unix_timestamp_nanos()
            );
            let provider = transcription_provider(params);
            let imported_path = params
                .get("importedTranscriptPath")
                .and_then(Value::as_str)
                .unwrap_or("");
            let (coverage, blocking_reason) = if force {
                (
                    json!({
                        "hook": true,
                        "action": true,
                        "payoff": true,
                        "takeaway": true,
                    }),
                    None,
                )
            } else if provider == "imported_transcript" {
                match transcript_coverage(imported_path) {
                    Some((coverage, has_tokens)) => (
                        coverage,
                        if has_tokens {
                            Some("weak_narrative_structure")
                        } else {
                            Some("empty_transcript")
                        },
                    ),
                    None => (
                        json!({
                            "hook": false,
                            "action": false,
                            "payoff": false,
                            "takeaway": false,
                        }),
                        Some("empty_transcript"),
                    ),
                }
            } else {
                let duration = state.current_duration();
                (
                    json!({
                        "hook": true,
                        "action": duration >= 15.0,
                        "payoff": duration >= 30.0,
                        "takeaway": duration >= 45.0,
                    }),
                    Some("weak_narrative_structure"),
                )
            };
            let run = build_agent_run(
                job_id.clone(),
                runtime_budget_minutes,
                coverage,
                blocking_reason,
            );
            let status = run.status;
            state.agent_runs.insert(job_id.clone(), run);
            state.unsaved_changes = true;
            success(&request.id, json!({ "jobId": job_id, "status": status }))
        }
        EngineMethod::AgentStatus => {
            let job_id = match get_string(params, "jobId") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "jobId is required",
                    )
                }
            };
            let run = match state.agent_runs.get(&job_id) {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        format!("Unknown jobId: {job_id}"),
                    )
                }
            };
            success(
                &request.id,
                json!({
                    "jobId": run.job_id,
                    "status": run.status,
                    "runtimeBudgetMinutes": run.runtime_budget_minutes,
                    "qaReport": run.qa_report,
                    "blockingReason": run.blocking_reason,
                    "updatedAt": run.updated_at,
                }),
            )
        }
        EngineMethod::AgentApply => {
            let job_id = match get_string(params, "jobId") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "jobId is required",
                    )
                }
            };
            let destructive_intent = params
                .get("destructiveIntent")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let run = match state.agent_runs.get(&job_id) {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        format!("Unknown jobId: {job_id}"),
                    )
                }
            };

            let qa_passed = run
                .qa_report
                .get("passed")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !qa_passed {
                return failure(
                    &request.id,
                    ProtocolErrorCode::QaFailed,
                    "Narrative QA failed. Apply is blocked.",
                );
            }
            if state.unsaved_changes && !destructive_intent {
                return failure(
                    &request.id,
                    ProtocolErrorCode::NeedsConfirmation,
                    "Unsaved project changes detected. Retry with destructiveIntent=true to continue.",
                );
            }
            state.unsaved_changes = true;
            success(
                &request.id,
                json!({
                    "success": true,
                    "message": "Applied cut plan to working timeline.",
                }),
            )
        }
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
        EngineMethod::CaptureStartCurrentWindow => {
            state.is_running = true;
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
            state.unsaved_changes = true;
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
        EngineMethod::ExportRunCutPlan => {
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
            if get_string(params, "presetId").is_none() {
                return failure(
                    &request.id,
                    ProtocolErrorCode::InvalidParams,
                    "presetId is required",
                );
            }
            let job_id = match get_string(params, "jobId") {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        "jobId is required",
                    )
                }
            };
            let run = match state.agent_runs.get(&job_id) {
                Some(value) => value,
                None => {
                    return failure(
                        &request.id,
                        ProtocolErrorCode::InvalidParams,
                        format!("Unknown jobId: {job_id}"),
                    )
                }
            };
            let qa_passed = run
                .qa_report
                .get("passed")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !qa_passed {
                return failure(
                    &request.id,
                    ProtocolErrorCode::QaFailed,
                    "Narrative QA failed. Cut-plan export is blocked.",
                );
            }
            let applied_segments = run
                .qa_report
                .get("coverage")
                .and_then(Value::as_object)
                .map(|coverage| {
                    coverage
                        .values()
                        .filter_map(Value::as_bool)
                        .filter(|value| *value)
                        .count()
                })
                .unwrap_or(0);
            if applied_segments == 0 {
                return failure(
                    &request.id,
                    ProtocolErrorCode::InvalidCutPlan,
                    "Cut plan artifact is missing.",
                );
            }

            let output_path = PathBuf::from(&output_url);
            if let Some(parent) = output_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&output_path, b"guerillaglass-native-cut-plan-export");

            success(
                &request.id,
                json!({
                    "outputURL": output_url,
                    "appliedSegments": applied_segments,
                }),
            )
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
            state.unsaved_changes = false;
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
            state.unsaved_changes = false;

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

/// Runs the native foundation stdio request loop until stdin is closed.
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
