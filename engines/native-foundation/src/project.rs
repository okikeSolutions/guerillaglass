use crate::params::{ProjectOpenParams, ProjectRecentsParams, ProjectSaveParams};
use crate::path_security::{
    create_directory_all_no_symlink, reject_final_symlink, write_file_no_symlink,
};
use crate::state::{record_recent_project, State};
use crate::DEFAULT_RECENTS_LIMIT;
use protocol_rust::{failure, success, EngineResponse, JsonRpcId, ProtocolErrorCode};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn validate_project_path(id: &JsonRpcId, project_path: &str) -> Result<(), EngineResponse> {
    let path = Path::new(project_path);
    if !path.is_absolute() {
        return Err(failure(
            id,
            ProtocolErrorCode::InvalidParams,
            "projectPath must be an absolute path",
        ));
    }
    if path.extension().and_then(|value| value.to_str()) != Some("gglassproj") {
        return Err(failure(
            id,
            ProtocolErrorCode::InvalidParams,
            "projectPath must end with .gglassproj",
        ));
    }
    if let Err(error) = reject_final_symlink(path) {
        return Err(failure(
            id,
            ProtocolErrorCode::PermissionDenied,
            format!("projectPath failed symlink safety validation: {error}"),
        ));
    }
    Ok(())
}

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
    if let Err(response) = validate_project_path(id, &project_path) {
        return response;
    }
    state.project_path = Some(project_path.clone());
    state.unsaved_changes = false;
    record_recent_project(state, &project_path);
    success(id, state.project_state())
}

pub(crate) fn save(id: &JsonRpcId, state: &mut State, params: &Value) -> EngineResponse {
    let project_params: ProjectSaveParams = decode_params(params);
    if let Some(project_path) = project_params.project_path {
        if let Err(response) = validate_project_path(id, &project_path) {
            return response;
        }
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
        if let Err(error) = create_directory_all_no_symlink(&directory) {
            return failure(
                id,
                ProtocolErrorCode::PermissionDenied,
                format!("Unable to create project directory safely: {error}"),
            );
        }
        let snapshot_path = directory.join("project.native.json");
        if let Err(error) =
            write_file_no_symlink(&snapshot_path, state.project_state().to_string().as_bytes())
        {
            return failure(
                id,
                ProtocolErrorCode::PermissionDenied,
                format!("Unable to write project snapshot safely: {error}"),
            );
        }
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
