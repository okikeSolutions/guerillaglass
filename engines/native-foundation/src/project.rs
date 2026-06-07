use crate::params::{ProjectOpenParams, ProjectRecentsParams, ProjectSaveParams};
use crate::state::{record_recent_project, State};
use crate::DEFAULT_RECENTS_LIMIT;
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

pub(crate) fn current(id: &JsonRpcId, state: &State) -> EngineResponse {
    success(id, state.project_state())
}

pub(crate) fn open(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let project_params: ProjectOpenParams = decode_params(params);
    let project_path = match project_params.project_path {
        Some(value) => value,
        None => {
            return failure(
                id,
                ProtocolErrorCode::InvalidParams,
                "projectPath is required",
            )
        }
    };
    state.project_path = Some(project_path.clone());
    state.unsaved_changes = false;
    record_recent_project(state, &project_path);
    success(id, state.project_state())
}

pub(crate) fn save(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let project_params: ProjectSaveParams = decode_params(params);
    if let Some(project_path) = project_params.project_path {
        state.project_path = Some(project_path);
    }

    if let Some(auto_zoom) = project_params.auto_zoom {
        state.auto_zoom_enabled = auto_zoom.is_enabled.unwrap_or(state.auto_zoom_enabled);
        state.auto_zoom_intensity = auto_zoom
            .intensity
            .unwrap_or(state.auto_zoom_intensity)
            .clamp(0.0, 1.0);
        state.auto_zoom_min_keyframe_interval = auto_zoom
            .minimum_keyframe_interval
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

    success(id, state.project_state())
}

pub(crate) fn recents(id: &JsonRpcId, state: &State, params: &Value) -> EngineResponse {
    let project_params: ProjectRecentsParams = decode_params(params);
    let limit = project_params
        .limit
        .map(|value| value.min(100) as usize)
        .unwrap_or(DEFAULT_RECENTS_LIMIT);
    let items = state
        .recent_projects
        .iter()
        .take(limit)
        .cloned()
        .collect::<Vec<Value>>();
    success(id, json!({ "items": items }))
}
