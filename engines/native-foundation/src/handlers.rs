use crate::agent::agent_preflight;
use crate::state::State;
use crate::{capture, export, permissions, project, sources, system};
use protocol_rust::{
    failure, success, EngineMethod, EngineRequest, EngineResponse, ProtocolErrorCode,
};

pub(crate) fn handle_request(
    platform: &str,
    state: &mut State,
    request: &EngineRequest,
) -> EngineResponse {
    let Some(method) = request.method_kind() else {
        return failure(
            &request.id,
            ProtocolErrorCode::UnsupportedMethod,
            format!("Unsupported method: {}", request.method),
        );
    };

    let params = &request.params;
    match method {
        EngineMethod::SystemPing => system::ping(&request.id, platform),
        EngineMethod::EngineCapabilities => system::capabilities(&request.id, platform),
        EngineMethod::AgentPreflight => success(&request.id, agent_preflight(state, params)),
        EngineMethod::AgentRun => crate::agent::run(&request.id, state, params),
        EngineMethod::AgentStatus => crate::agent::status(&request.id, state, params),
        EngineMethod::AgentApply => crate::agent::apply(&request.id, state, params),
        EngineMethod::PermissionsGet => permissions::get(&request.id),
        EngineMethod::PermissionsRequestScreenRecording
        | EngineMethod::PermissionsRequestMicrophone
        | EngineMethod::PermissionsRequestInputMonitoring
        | EngineMethod::PermissionsOpenInputMonitoringSettings => {
            permissions::request_or_open_settings(&request.id)
        }
        EngineMethod::SourcesList => sources::list(&request.id),
        EngineMethod::CaptureStartDisplay => capture::start_display(&request.id, state, params),
        EngineMethod::CaptureStartCurrentWindow => {
            capture::start_current_window(&request.id, state, params)
        }
        EngineMethod::CaptureStartWindow => capture::start_window(&request.id, state, params),
        EngineMethod::CaptureStop => capture::stop_capture(&request.id, state),
        EngineMethod::RecordingStart => capture::start_recording(&request.id, state, params),
        EngineMethod::RecordingStop => capture::stop_recording(&request.id, state),
        EngineMethod::CaptureStatus | EngineMethod::CaptureStatusStream => {
            capture::status(&request.id, state)
        }
        EngineMethod::CapturePreviewFrame | EngineMethod::CapturePreviewFrameStream => {
            capture::preview_frame(&request.id)
        }
        EngineMethod::ExportInfo => export::info(&request.id),
        EngineMethod::ExportRun => export::run(&request.id, params),
        EngineMethod::ExportRunCutPlan => export::run_cut_plan(&request.id, state, params),
        EngineMethod::ProjectCurrent => project::current(&request.id, state),
        EngineMethod::ProjectOpen => project::open(&request.id, state, params),
        EngineMethod::ProjectSave => project::save(&request.id, state, params),
        EngineMethod::ProjectRecents => project::recents(&request.id, state, params),
    }
}
