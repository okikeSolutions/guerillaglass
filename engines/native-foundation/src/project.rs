use crate::params::{
    BackgroundFramingParams, ProjectOpenParams, ProjectRecentsParams, ProjectSaveParams,
};
use crate::path_security::{
    create_directory_all_no_symlink, reject_final_symlink, write_file_no_symlink,
};
use crate::state::{record_recent_project, State};
use crate::wire::{failure, success, EngineCallId, EngineResponse, ProtocolErrorCode};
use crate::DEFAULT_RECENTS_LIMIT;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

fn validate_project_path(id: &EngineCallId, project_path: &str) -> Result<(), EngineResponse> {
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

fn load_background_framing(project_path: &str) -> Result<BackgroundFramingParams, String> {
    let snapshot_path = Path::new(project_path).join("project.native.json");
    if !snapshot_path.exists() {
        return Ok(BackgroundFramingParams::default());
    }
    reject_final_symlink(&snapshot_path)
        .map_err(|error| format!("Project snapshot failed symlink safety validation: {error}"))?;
    let data = fs::read_to_string(&snapshot_path)
        .map_err(|error| format!("Unable to read project snapshot: {error}"))?;
    let snapshot: Value = serde_json::from_str(&data)
        .map_err(|error| format!("Unable to decode project snapshot: {error}"))?;
    let Some(value) = snapshot.get("backgroundFraming") else {
        return Ok(BackgroundFramingParams::default());
    };
    serde_json::from_value::<BackgroundFramingParams>(value.clone())
        .map_err(|error| format!("Invalid backgroundFraming settings: {error}"))?
        .validated()
        .map_err(str::to_string)
}

fn decode_params<T>(params: &Value) -> T
where
    T: for<'de> serde::Deserialize<'de> + Default,
{
    serde_json::from_value(params.clone()).unwrap_or_default()
}

pub(crate) fn current(id: &EngineCallId, state: &State) -> EngineResponse {
    success(id, state.project_state())
}

pub(crate) fn open(id: &EngineCallId, state: &mut State, params: &Value) -> EngineResponse {
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
    let background_framing = match load_background_framing(&project_path) {
        Ok(settings) => settings,
        Err(error) => return failure(id, ProtocolErrorCode::InvalidParams, error),
    };
    state.project_path = Some(project_path.clone());
    state.background_framing = background_framing;
    state.unsaved_changes = false;
    record_recent_project(state, &project_path);
    success(id, state.project_state())
}

pub(crate) fn save(id: &EngineCallId, state: &mut State, params: &Value) -> EngineResponse {
    let project_params: ProjectSaveParams = match serde_json::from_value(params.clone()) {
        Ok(params) => params,
        Err(error) => {
            return failure(
                id,
                ProtocolErrorCode::InvalidParams,
                format!("Invalid project save payload: {error}"),
            )
        }
    };
    let background_framing = match project_params.background_framing {
        Some(settings) => match settings.validated() {
            Ok(settings) => Some(settings),
            Err(error) => return failure(id, ProtocolErrorCode::InvalidParams, error),
        },
        None => None,
    };
    let mut next_state = state.clone();
    if let Some(project_path) = project_params.project_path {
        if let Err(response) = validate_project_path(id, &project_path) {
            return response;
        }
        next_state.project_path = Some(project_path);
    }

    if let Some(background_framing) = background_framing {
        next_state.background_framing = background_framing;
    }

    if let Some(auto_zoom) = project_params.auto_zoom {
        next_state.auto_zoom_enabled = auto_zoom.is_enabled.unwrap_or(next_state.auto_zoom_enabled);
        next_state.auto_zoom_intensity = auto_zoom
            .intensity
            .unwrap_or(next_state.auto_zoom_intensity)
            .clamp(0.0, 1.0);
        next_state.auto_zoom_min_keyframe_interval = auto_zoom
            .minimum_keyframe_interval
            .unwrap_or(next_state.auto_zoom_min_keyframe_interval)
            .max(0.0001);
    }
    next_state.unsaved_changes = false;

    if let Some(project_path) = next_state.project_path.clone() {
        let directory = PathBuf::from(&project_path);
        if let Err(error) = create_directory_all_no_symlink(&directory) {
            return failure(
                id,
                ProtocolErrorCode::PermissionDenied,
                format!("Unable to create project directory safely: {error}"),
            );
        }
        let snapshot_path = directory.join("project.native.json");
        if let Err(error) = write_file_no_symlink(
            &snapshot_path,
            next_state.project_state().to_string().as_bytes(),
        ) {
            return failure(
                id,
                ProtocolErrorCode::PermissionDenied,
                format!("Unable to write project snapshot safely: {error}"),
            );
        }
        record_recent_project(&mut next_state, &project_path);
    }

    *state = next_state;
    success(id, state.project_state())
}

pub(crate) fn recents(id: &EngineCallId, state: &State, params: &Value) -> EngineResponse {
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
