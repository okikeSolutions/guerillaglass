use crate::params::ExportRunParams;
use crate::path_security::{reject_final_symlink, write_file_no_symlink};
use crate::state::State;
use crate::wire::{failure, success, EngineCallId, EngineResponse, ProtocolErrorCode};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn validate_export_path(id: &EngineCallId, output_url: &str) -> Result<(), EngineResponse> {
    let path = Path::new(output_url);
    if !path.is_absolute() {
        return Err(failure(
            id,
            ProtocolErrorCode::InvalidParams,
            "outputURL must be an absolute path",
        ));
    }
    match path.extension().and_then(|value| value.to_str()) {
        Some("mp4") | Some("mov") => {}
        _ => {
            return Err(failure(
                id,
                ProtocolErrorCode::InvalidParams,
                "outputURL must end with .mp4 or .mov",
            ))
        }
    }
    if let Err(error) = reject_final_symlink(path) {
        return Err(failure(
            id,
            ProtocolErrorCode::PermissionDenied,
            format!("outputURL failed symlink safety validation: {error}"),
        ));
    }
    Ok(())
}

pub(crate) fn info(id: &EngineCallId) -> EngineResponse {
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

pub(crate) fn run(id: &EngineCallId, state: &mut State, params: &Value) -> EngineResponse {
    let export_params: ExportRunParams = match serde_json::from_value(params.clone()) {
        Ok(params) => params,
        Err(error) => {
            return failure(
                id,
                ProtocolErrorCode::InvalidParams,
                format!("Invalid export payload: {error}"),
            )
        }
    };
    let resolved_background_framing = match export_params.background_framing {
        Some(settings) => match settings.validated() {
            Ok(settings) => settings,
            Err(error) => return failure(id, ProtocolErrorCode::InvalidParams, error),
        },
        None => state.background_framing.clone(),
    };
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

    if let Err(response) = validate_export_path(id, &output_url) {
        return response;
    }

    let output_path = PathBuf::from(&output_url);
    if let Err(error) = write_file_no_symlink(&output_path, b"guerillaglass-native-export") {
        return failure(
            id,
            ProtocolErrorCode::PermissionDenied,
            format!("Unable to write export safely: {error}"),
        );
    }

    state.latest_export_background_framing = Some(resolved_background_framing);

    success(
        id,
        json!({
            "jobId": format!("export-{}", id),
            "status": "succeeded",
            "outputURL": output_url,
        }),
    )
}
