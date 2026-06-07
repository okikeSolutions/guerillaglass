use crate::params::{ExportRunCutPlanParams, ExportRunParams};
use crate::state::State;
use protocol_rust::{failure, success, EngineResponse, JsonRpcId, ProtocolErrorCode};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

fn decode_params<T>(params: &Value) -> T
where
    T: for<'de> serde::Deserialize<'de> + Default,
{
    serde_json::from_value(params.clone()).unwrap_or_default()
}

pub(crate) fn info(id: &JsonRpcId) -> EngineResponse {
    success(
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
    )
}

pub(crate) fn run(id: &JsonRpcId, params: &Value) -> EngineResponse {
    let export_params: ExportRunParams = decode_params(params);
    let output_url = match export_params.output_url {
        Some(value) => value,
        None => {
            return failure(
                id,
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

    success(id, json!({ "outputURL": output_url }))
}

pub(crate) fn run_cut_plan(id: &JsonRpcId, state: &State, params: &Value) -> EngineResponse {
    let export_params: ExportRunCutPlanParams = decode_params(params);
    let output_url = match export_params.output_url {
        Some(value) => value,
        None => {
            return failure(
                id,
                ProtocolErrorCode::InvalidParams,
                "outputURL is required",
            )
        }
    };
    if export_params.preset_id.is_none() {
        return failure(id, ProtocolErrorCode::InvalidParams, "presetId is required");
    }
    let job_id = match export_params.job_id {
        Some(value) => value,
        None => return failure(id, ProtocolErrorCode::InvalidParams, "jobId is required"),
    };
    let run = match state.agent_runs.get(&job_id) {
        Some(value) => value,
        None => {
            return failure(
                id,
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
            id,
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
            id,
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
        id,
        json!({
            "outputURL": output_url,
            "appliedSegments": applied_segments,
        }),
    )
}
