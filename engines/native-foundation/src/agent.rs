use crate::params::{AgentRunParams, JobParams};
use crate::state::{now_iso8601, AgentRunState, PreflightSession, State};
use crate::wire::{failure, success, EngineCallId, EngineResponse, ProtocolErrorCode};
use crate::PREFLIGHT_TOKEN_TTL_SECONDS;
use serde_json::{json, Value};
use std::fs;
use time::format_description::well_known::Rfc3339;
use time::{Duration, OffsetDateTime};

fn decode_params<T>(params: &Value) -> T
where
    T: for<'de> serde::Deserialize<'de> + Default,
{
    serde_json::from_value(params.clone()).unwrap_or_default()
}

pub(crate) fn transcription_provider(params: &Value) -> &'static str {
    match params
        .get("transcriptionProvider")
        .and_then(Value::as_str)
        .unwrap_or("none")
    {
        "imported_transcript" => "imported_transcript",
        _ => "none",
    }
}

pub(crate) fn now_unix_seconds() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

pub(crate) fn imported_transcript_payload(path: &str) -> Option<Value> {
    if path.is_empty() {
        return None;
    }
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&data).ok()
}

pub(crate) fn numeric_time(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64)
}

pub(crate) fn normalized_segment(entry: &Value) -> Option<String> {
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

pub(crate) fn normalized_word(entry: &Value) -> Option<String> {
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

pub(crate) fn normalized_imported_transcript(path: &str) -> Option<(Vec<String>, Vec<String>)> {
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

pub(crate) fn imported_transcript_is_valid(path: &str) -> bool {
    normalized_imported_transcript(path).is_some()
}

pub(crate) fn transcript_tokens(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(String::from)
        .collect::<Vec<String>>()
}

pub(crate) fn has_any_token(tokens: &[String], candidates: &[&str]) -> bool {
    candidates
        .iter()
        .any(|candidate| tokens.iter().any(|token| token == candidate))
}

pub(crate) fn transcript_coverage(path: &str) -> Option<(Value, bool)> {
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

pub(crate) struct AgentPreflightEvaluation {
    ready: bool,
    blocking_reasons: Vec<&'static str>,
    runtime_budget_minutes: i64,
    provider: String,
    imported_transcript_path: String,
}

pub(crate) fn evaluate_agent_preflight(state: &State, params: &Value) -> AgentPreflightEvaluation {
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

pub(crate) fn preflight_token() -> String {
    format!(
        "preflight-{}",
        OffsetDateTime::now_utc().unix_timestamp_nanos()
    )
}

pub(crate) fn agent_preflight(state: &mut State, params: &Value) -> Value {
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

    let expires_at = token.as_ref().map(|_| {
        (OffsetDateTime::now_utc() + Duration::seconds(PREFLIGHT_TOKEN_TTL_SECONDS))
            .format(&Rfc3339)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    });
    json!({
        "ready": evaluation.ready,
        "blockingReasons": evaluation.blocking_reasons,
        "canApplyDestructive": state.unsaved_changes,
        "transcriptionProvider": evaluation.provider,
        "preflightToken": token,
        "preflightTokenExpiresAt": expires_at,
    })
}

pub(crate) enum PreflightTokenValidationError {
    Expired,
    Mismatch,
}

pub(crate) fn validate_preflight_token(
    state: &mut State,
    token: &str,
    params: &Value,
) -> Result<(), PreflightTokenValidationError> {
    if token.is_empty() {
        return Err(PreflightTokenValidationError::Expired);
    }

    let session = match state.preflight_sessions.get(token) {
        Some(session) => session.clone(),
        None => return Err(PreflightTokenValidationError::Expired),
    };

    if now_unix_seconds() - session.created_at_unix_seconds > PREFLIGHT_TOKEN_TTL_SECONDS {
        state.preflight_sessions.remove(token);
        return Err(PreflightTokenValidationError::Expired);
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
        return Err(PreflightTokenValidationError::Mismatch);
    }

    state.preflight_sessions.remove(token);
    Ok(())
}

pub(crate) fn build_agent_run(
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

pub(crate) fn run(id: &EngineCallId, state: &mut State, params: &Value) -> EngineResponse {
    let agent_params: AgentRunParams = decode_params(params);
    let token = agent_params.preflight_token.as_deref().unwrap_or("");
    if let Err(error) = validate_preflight_token(state, token, params) {
        return match error {
            PreflightTokenValidationError::Expired => failure(
                id,
                ProtocolErrorCode::PreflightExpired,
                "preflightToken is missing, expired, or already consumed. Run agent.preflight again.",
            ),
            PreflightTokenValidationError::Mismatch => failure(
                id,
                ProtocolErrorCode::PreflightMismatch,
                "preflightToken does not match current run parameters. Run agent.preflight again.",
            ),
        };
    }

    let runtime_budget_minutes = agent_params.runtime_budget_minutes.unwrap_or(10);
    let force = agent_params.force.unwrap_or(false);
    if !(1..=10).contains(&runtime_budget_minutes) {
        return failure(
            id,
            ProtocolErrorCode::InvalidParams,
            "runtimeBudgetMinutes must be between 1 and 10",
        );
    }
    if force && std::env::var("GG_AGENT_ALLOW_FORCE").ok().as_deref() != Some("1") {
        return failure(
            id,
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
    let imported_path = agent_params
        .imported_transcript_path
        .as_deref()
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
    success(id, json!({ "jobId": job_id, "status": status }))
}

pub(crate) fn status(id: &EngineCallId, state: &State, params: &Value) -> EngineResponse {
    let job_params: JobParams = decode_params(params);
    let job_id = match job_params.job_id {
        Some(value) => value,
        None => return failure(id, ProtocolErrorCode::InvalidParams, "jobId is required"),
    };
    let run = match state.agent_runs.get(&job_id) {
        Some(value) => value,
        None => {
            return failure(
                id,
                ProtocolErrorCode::NotFound,
                format!("Unknown jobId: {job_id}"),
            )
        }
    };
    success(
        id,
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

pub(crate) fn apply(id: &EngineCallId, state: &mut State, params: &Value) -> EngineResponse {
    let job_params: JobParams = decode_params(params);
    let job_id = match job_params.job_id {
        Some(value) => value,
        None => return failure(id, ProtocolErrorCode::InvalidParams, "jobId is required"),
    };
    let destructive_intent = job_params.destructive_intent.unwrap_or(false);
    let run = match state.agent_runs.get(&job_id) {
        Some(value) => value,
        None => {
            return failure(
                id,
                ProtocolErrorCode::NotFound,
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
            id,
            ProtocolErrorCode::QaFailed,
            "Narrative QA failed. Apply is blocked.",
        );
    }
    if state.unsaved_changes && !destructive_intent {
        return failure(
            id,
            ProtocolErrorCode::NeedsConfirmation,
            "Unsaved project changes detected. Retry with destructiveIntent=true to continue.",
        );
    }
    state.unsaved_changes = true;
    success(
        id,
        json!({
            "success": true,
            "message": "Applied foundation-shell Agent state.",
            "jobId": job_id,
            "status": "applied",
            "appliedSegments": 1,
            "projectHasUnsavedChanges": true,
        }),
    )
}
