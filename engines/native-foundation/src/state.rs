use crate::params::BackgroundFramingParams;
use crate::path_security::{create_directory_all_no_symlink, write_file_no_symlink};
use crate::wire::{CaptureClock, RunningDuration};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

pub(crate) const MAX_RECENT_PROJECTS: usize = 20;

#[derive(Clone)]
pub(crate) struct AgentRunState {
    pub(crate) job_id: String,
    pub(crate) status: &'static str,
    pub(crate) runtime_budget_minutes: i64,
    pub(crate) blocking_reason: Option<&'static str>,
    pub(crate) updated_at: String,
    pub(crate) qa_report: Value,
}

#[derive(Clone)]
pub(crate) struct PreflightSession {
    pub(crate) token: String,
    pub(crate) ready: bool,
    pub(crate) runtime_budget_minutes: i64,
    pub(crate) transcription_provider: String,
    pub(crate) imported_transcript_path: String,
    pub(crate) project_path: Option<String>,
    pub(crate) recording_url: Option<String>,
    pub(crate) created_at_unix_seconds: i64,
}

pub(crate) struct State {
    pub(crate) clock: CaptureClock,
    pub(crate) is_running: bool,
    pub(crate) is_recording: bool,
    pub(crate) capture_session_id: Option<String>,
    pub(crate) next_capture_session_id: u64,
    pub(crate) recording_duration: RunningDuration,
    pub(crate) recording_url: Option<String>,
    pub(crate) events_url: Option<String>,
    pub(crate) last_error: Option<String>,
    pub(crate) project_path: Option<String>,
    pub(crate) auto_zoom_enabled: bool,
    pub(crate) auto_zoom_intensity: f64,
    pub(crate) auto_zoom_min_keyframe_interval: f64,
    pub(crate) background_framing: BackgroundFramingParams,
    pub(crate) latest_export_background_framing: Option<BackgroundFramingParams>,
    pub(crate) capture_metadata: Option<Value>,
    pub(crate) recent_projects: Vec<Value>,
    pub(crate) recents_index_path: PathBuf,
    pub(crate) unsaved_changes: bool,
    pub(crate) agent_runs: HashMap<String, AgentRunState>,
    pub(crate) preflight_sessions: HashMap<String, PreflightSession>,
}

impl State {
    pub(crate) fn new(recents_index_path: PathBuf) -> Self {
        let recent_projects = load_recent_projects(&recents_index_path);
        Self {
            clock: CaptureClock::default(),
            is_running: false,
            is_recording: false,
            capture_session_id: None,
            next_capture_session_id: 0,
            recording_duration: RunningDuration::default(),
            recording_url: None,
            events_url: None,
            last_error: None,
            project_path: None,
            auto_zoom_enabled: false,
            auto_zoom_intensity: 0.55,
            auto_zoom_min_keyframe_interval: 0.15,
            background_framing: BackgroundFramingParams::default(),
            latest_export_background_framing: None,
            capture_metadata: None,
            recent_projects,
            recents_index_path,
            unsaved_changes: false,
            agent_runs: HashMap::new(),
            preflight_sessions: HashMap::new(),
        }
    }

    pub(crate) fn current_duration(&self) -> f64 {
        self.recording_duration.current(&self.clock)
    }

    pub(crate) fn begin_capture_session(&mut self) {
        self.next_capture_session_id += 1;
        self.capture_session_id = Some(format!("capture-session-{}", self.next_capture_session_id));
    }

    pub(crate) fn capture_status(&self) -> Value {
        json!({
            "isRunning": self.is_running,
            "isRecording": self.is_recording,
            "captureSessionId": self.capture_session_id,
            "recordingDurationSeconds": self.current_duration(),
            "recordingURL": self.recording_url,
            "captureMetadata": self.capture_metadata,
            "lastError": self.last_error,
            "eventsURL": self.events_url,
            "lastRecordingTelemetry": Value::Null,
            "telemetry": {
                "sourceDroppedFrames": 0,
                "writerDroppedFrames": 0,
                "writerBackpressureDrops": 0,
                "achievedFps": 0.0,
                "cpuPercent": Value::Null,
                "memoryBytes": Value::Null,
                "recordingBitrateMbps": Value::Null,
                "captureCallbackMs": 0.0,
                "recordQueueLagMs": 0.0,
                "writerAppendMs": 0.0,
            },
        })
    }

    pub(crate) fn project_state(&self) -> Value {
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
            "backgroundFraming": self.background_framing,
            "captureMetadata": self.capture_metadata,
            "timeline": {
                "version": 2,
                "items": [],
                "updatedAt": now_iso8601(),
            },
            "agentAnalysis": {
                "latestJobId": latest_run.map(|run| run.job_id.clone()),
                "latestStatus": latest_run.map(|run| run.status),
                "qaPassed": latest_run.and_then(|run| run.qa_report.get("passed").and_then(Value::as_bool)),
                "updatedAt": latest_run.map(|run| run.updated_at.clone()),
            },
        })
    }
}

pub(crate) fn now_iso8601() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub(crate) fn load_recent_projects(index_path: &Path) -> Vec<Value> {
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

pub(crate) fn save_recent_projects(index_path: &Path, items: &[Value]) {
    if let Some(parent) = index_path.parent() {
        let _ = create_directory_all_no_symlink(parent);
    }
    let _ = write_file_no_symlink(index_path, json!({ "items": items }).to_string().as_bytes());
}

pub(crate) fn is_valid_recent_project_item(item: &Value) -> bool {
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

pub(crate) fn record_recent_project(state: &mut State, project_path: &str) {
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
