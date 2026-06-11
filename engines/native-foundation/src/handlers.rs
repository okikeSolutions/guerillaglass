use crate::agent::agent_preflight;
use crate::state::State;
use crate::wire::{success, EngineMethod, EngineResponse};
use crate::{capture, export, permissions, project, sources, system};

#[cfg(test)]
use crate::wire::EngineRequest;

#[cfg(test)]
pub(crate) fn handle_request(
    platform: &str,
    state: &mut State,
    request: &EngineRequest,
) -> EngineResponse {
    let id = request.id.as_str();
    match request.method {
        EngineMethod::SystemPing => system::ping(id, platform),
        EngineMethod::EngineCapabilities => system::capabilities(id, platform),
        EngineMethod::AgentPreflight => success(id, agent_preflight(state, &request.params)),
        EngineMethod::AgentRun => crate::agent::run(id, state, &request.params),
        EngineMethod::AgentStatus => crate::agent::status(id, state, &request.params),
        EngineMethod::AgentApply => crate::agent::apply(id, state, &request.params),
        _ => handle_method(platform, state, request.method, &request.params),
    }
}

pub(crate) fn handle_method(
    platform: &str,
    state: &mut State,
    method: EngineMethod,
    params: &serde_json::Value,
) -> EngineResponse {
    let id = method.call_id();
    match method {
        EngineMethod::SystemPing => system::ping(id, platform),
        EngineMethod::EngineCapabilities => system::capabilities(id, platform),
        EngineMethod::AgentPreflight => success(id, agent_preflight(state, params)),
        EngineMethod::AgentRun => crate::agent::run(id, state, params),
        EngineMethod::AgentStatus => crate::agent::status(id, state, params),
        EngineMethod::AgentApply => crate::agent::apply(id, state, params),
        EngineMethod::PermissionsGet => permissions::get(id),
        EngineMethod::PermissionsRequestScreenRecording
        | EngineMethod::PermissionsRequestMicrophone
        | EngineMethod::PermissionsRequestInputMonitoring
        | EngineMethod::PermissionsOpenInputMonitoringSettings => {
            permissions::request_or_open_settings(id)
        }
        EngineMethod::SourcesList => sources::list(id),
        EngineMethod::CaptureStartDisplay => capture::start_display(id, state, params),
        EngineMethod::CaptureStartCurrentWindow => capture::start_current_window(id, state, params),
        EngineMethod::CaptureStartWindow => capture::start_window(id, state, params),
        EngineMethod::CaptureStop => capture::stop_capture(id, state),
        EngineMethod::RecordingStart => capture::start_recording(id, state, params),
        EngineMethod::RecordingStop => capture::stop_recording(id, state),
        EngineMethod::CaptureStatus => capture::status(id, state),
        EngineMethod::CapturePreviewFrame => capture::preview_frame(id),
        EngineMethod::ExportInfo => export::info(id),
        EngineMethod::ExportRun => export::run(id, params),
        EngineMethod::ExportRunCutPlan => export::run_cut_plan(id, state, params),
        EngineMethod::ProjectCurrent => project::current(id, state),
        EngineMethod::ProjectOpen => project::open(id, state, params),
        EngineMethod::ProjectSave => project::save(id, state, params),
        EngineMethod::ProjectRecents => project::recents(id, state, params),
    }
}
