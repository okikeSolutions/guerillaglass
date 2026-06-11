use crate::handlers::handle_method;
use crate::wire::{EngineMethod, EngineResponse, ProtocolErrorCode};
use crate::{EngineRuntimeConfig, State};
use async_trait::async_trait;
use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::Router;
use protocol_rust::{apis, models, server};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tower_http::limit::RequestBodyLimitLayer;

const MAX_HTTP_BODY_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone)]
struct NativeFoundationApi {
    platform: &'static str,
    state: Arc<Mutex<State>>,
    bearer_token: String,
}

impl AsRef<NativeFoundationApi> for NativeFoundationApi {
    fn as_ref(&self) -> &NativeFoundationApi {
        self
    }
}

impl NativeFoundationApi {
    fn new(config: EngineRuntimeConfig, bearer_token: String) -> Self {
        Self {
            platform: config.platform,
            state: Arc::new(Mutex::new(State::new(config.recents_index_path))),
            bearer_token,
        }
    }

    fn call(
        &self,
        method: EngineMethod,
        params: Value,
    ) -> Result<Value, models::EngineBadRequestError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| bad_request("runtime_error", "Engine state lock poisoned"))?;
        match handle_method(self.platform, &mut state, method, &params) {
            EngineResponse::Success { result, .. } => Ok(result),
            EngineResponse::Error { error, .. } => {
                Err(bad_request(error.code.as_str(), error.message))
            }
        }
    }

    fn model<T: DeserializeOwned>(
        &self,
        method: EngineMethod,
        params: Value,
    ) -> Result<T, models::EngineBadRequestError> {
        serde_json::from_value(self.call(method, params)?).map_err(|error| {
            bad_request(
                "runtime_error",
                format!("Engine response did not match contract: {error}"),
            )
        })
    }
}

fn bad_request(
    code: impl Into<String>,
    message: impl Into<String>,
) -> models::EngineBadRequestError {
    models::EngineBadRequestError::new(code.into(), message.into())
}

fn runtime_error(message: impl Into<String>) -> models::EngineRuntimeError {
    models::EngineRuntimeError::new("runtime_error".to_string(), message.into())
}

fn params_from_body<T: Serialize>(body: &T) -> Result<Value, models::EngineBadRequestError> {
    serde_json::to_value(body)
        .map_err(|error| bad_request("invalid_request", format!("Invalid request body: {error}")))
}

fn params_with_job_id(job_id: &str) -> Value {
    json!({ "jobId": job_id })
}

fn bad_or_runtime(error: models::EngineBadRequestError) -> bool {
    error.code == ProtocolErrorCode::RuntimeError.as_str()
}

#[async_trait]
impl apis::ApiAuthBasic for NativeFoundationApi {
    type Claims = ();

    async fn extract_claims_from_auth_header(
        &self,
        kind: apis::BasicAuthKind,
        headers: &HeaderMap,
        key: &str,
    ) -> Option<Self::Claims> {
        let value = headers.get(key)?.to_str().ok()?;
        (kind == apis::BasicAuthKind::Bearer && value == format!("Bearer {}", self.bearer_token))
            .then_some(())
    }
}

impl apis::ErrorHandler<()> for NativeFoundationApi {}

macro_rules! map_response {
    ($result:expr, $ok:path, $bad:path, $runtime:path) => {
        match $result {
            Ok(value) => Ok($ok(value)),
            Err(error) if bad_or_runtime(error.clone()) => {
                Ok($runtime(runtime_error(error.message)))
            }
            Err(error) => Ok($bad(error)),
        }
    };
}

#[async_trait]
impl apis::system::System<()> for NativeFoundationApi {
    type Claims = ();

    async fn system_engine_capabilities(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::system::SystemEngineCapabilitiesResponse, ()> {
        match self.model(EngineMethod::EngineCapabilities, json!({})) {
            Ok(value) => Ok(apis::system::SystemEngineCapabilitiesResponse::Status200_CapabilitiesResult(value)),
            Err(error) => Ok(apis::system::SystemEngineCapabilitiesResponse::Status500_EngineRuntimeErrorResponseBody(runtime_error(error.message))),
        }
    }

    async fn system_system_ping(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::system::SystemSystemPingResponse, ()> {
        match self.model(EngineMethod::SystemPing, json!({})) {
            Ok(value) => Ok(apis::system::SystemSystemPingResponse::Status200_PingResult(value)),
            Err(error) => Ok(
                apis::system::SystemSystemPingResponse::Status500_EngineRuntimeErrorResponseBody(
                    runtime_error(error.message),
                ),
            ),
        }
    }
}

#[async_trait]
impl apis::capture::Capture<()> for NativeFoundationApi {
    type Claims = ();

    async fn capture_capture_preview_frame(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::capture::CaptureCapturePreviewFrameResponse, ()> {
        map_response!(self.model(EngineMethod::CapturePreviewFrame, json!({})), apis::capture::CaptureCapturePreviewFrameResponse::Status200_CapturePreviewFrameResult, apis::capture::CaptureCapturePreviewFrameResponse::Status400_EngineBadRequestErrorResponseBody, apis::capture::CaptureCapturePreviewFrameResponse::Status500_EngineRuntimeErrorResponseBody)
    }

    async fn capture_capture_start_current_window(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::CaptureStartCurrentWindowPayload,
    ) -> Result<apis::capture::CaptureCaptureStartCurrentWindowResponse, ()> {
        map_response!(params_from_body(body).and_then(|params| self.model(EngineMethod::CaptureStartCurrentWindow, params)), apis::capture::CaptureCaptureStartCurrentWindowResponse::Status200_CaptureStatusResult, apis::capture::CaptureCaptureStartCurrentWindowResponse::Status400_EngineBadRequestErrorResponseBody, apis::capture::CaptureCaptureStartCurrentWindowResponse::Status500_EngineRuntimeErrorResponseBody)
    }

    async fn capture_capture_start_display(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::CaptureStartDisplayPayload,
    ) -> Result<apis::capture::CaptureCaptureStartDisplayResponse, ()> {
        map_response!(params_from_body(body).and_then(|params| self.model(EngineMethod::CaptureStartDisplay, params)), apis::capture::CaptureCaptureStartDisplayResponse::Status200_CaptureStatusResult, apis::capture::CaptureCaptureStartDisplayResponse::Status400_EngineBadRequestErrorResponseBody, apis::capture::CaptureCaptureStartDisplayResponse::Status500_EngineRuntimeErrorResponseBody)
    }

    async fn capture_capture_start_window(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::CaptureStartWindowPayload,
    ) -> Result<apis::capture::CaptureCaptureStartWindowResponse, ()> {
        map_response!(params_from_body(body).and_then(|params| self.model(EngineMethod::CaptureStartWindow, params)), apis::capture::CaptureCaptureStartWindowResponse::Status200_CaptureStatusResult, apis::capture::CaptureCaptureStartWindowResponse::Status400_EngineBadRequestErrorResponseBody, apis::capture::CaptureCaptureStartWindowResponse::Status500_EngineRuntimeErrorResponseBody)
    }

    async fn capture_capture_status(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::capture::CaptureCaptureStatusResponse, ()> {
        map_response!(self.model(EngineMethod::CaptureStatus, json!({})), apis::capture::CaptureCaptureStatusResponse::Status200_CaptureStatusResult, apis::capture::CaptureCaptureStatusResponse::Status400_EngineBadRequestErrorResponseBody, apis::capture::CaptureCaptureStatusResponse::Status500_EngineRuntimeErrorResponseBody)
    }

    async fn capture_capture_stop(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::capture::CaptureCaptureStopResponse, ()> {
        map_response!(
            self.model(EngineMethod::CaptureStop, json!({})),
            apis::capture::CaptureCaptureStopResponse::Status200_CaptureStatusResult,
            apis::capture::CaptureCaptureStopResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::capture::CaptureCaptureStopResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
}

#[async_trait]
impl apis::recording::Recording<()> for NativeFoundationApi {
    type Claims = ();
    async fn recording_recording_start(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::RecordingStartPayload,
    ) -> Result<apis::recording::RecordingRecordingStartResponse, ()> {
        map_response!(params_from_body(body).and_then(|params| self.model(EngineMethod::RecordingStart, params)), apis::recording::RecordingRecordingStartResponse::Status200_CaptureStatusResult, apis::recording::RecordingRecordingStartResponse::Status400_EngineBadRequestErrorResponseBody, apis::recording::RecordingRecordingStartResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn recording_recording_stop(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::recording::RecordingRecordingStopResponse, ()> {
        map_response!(self.model(EngineMethod::RecordingStop, json!({})), apis::recording::RecordingRecordingStopResponse::Status200_CaptureStatusResult, apis::recording::RecordingRecordingStopResponse::Status400_EngineBadRequestErrorResponseBody, apis::recording::RecordingRecordingStopResponse::Status500_EngineRuntimeErrorResponseBody)
    }
}

#[async_trait]
impl apis::permissions::Permissions<()> for NativeFoundationApi {
    type Claims = ();
    async fn permissions_permissions_get(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::permissions::PermissionsPermissionsGetResponse, ()> {
        map_response!(self.model(EngineMethod::PermissionsGet, json!({})), apis::permissions::PermissionsPermissionsGetResponse::Status200_PermissionsResult, apis::permissions::PermissionsPermissionsGetResponse::Status400_EngineBadRequestErrorResponseBody, apis::permissions::PermissionsPermissionsGetResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn permissions_permissions_open_input_monitoring_settings(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::permissions::PermissionsPermissionsOpenInputMonitoringSettingsResponse, ()>
    {
        map_response!(self.model(EngineMethod::PermissionsOpenInputMonitoringSettings, json!({})), apis::permissions::PermissionsPermissionsOpenInputMonitoringSettingsResponse::Status200_ActionResult, apis::permissions::PermissionsPermissionsOpenInputMonitoringSettingsResponse::Status400_EngineBadRequestErrorResponseBody, apis::permissions::PermissionsPermissionsOpenInputMonitoringSettingsResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn permissions_permissions_request_input_monitoring(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::permissions::PermissionsPermissionsRequestInputMonitoringResponse, ()> {
        map_response!(self.model(EngineMethod::PermissionsRequestInputMonitoring, json!({})), apis::permissions::PermissionsPermissionsRequestInputMonitoringResponse::Status200_ActionResult, apis::permissions::PermissionsPermissionsRequestInputMonitoringResponse::Status400_EngineBadRequestErrorResponseBody, apis::permissions::PermissionsPermissionsRequestInputMonitoringResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn permissions_permissions_request_microphone(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::permissions::PermissionsPermissionsRequestMicrophoneResponse, ()> {
        map_response!(self.model(EngineMethod::PermissionsRequestMicrophone, json!({})), apis::permissions::PermissionsPermissionsRequestMicrophoneResponse::Status200_ActionResult, apis::permissions::PermissionsPermissionsRequestMicrophoneResponse::Status400_EngineBadRequestErrorResponseBody, apis::permissions::PermissionsPermissionsRequestMicrophoneResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn permissions_permissions_request_screen_recording(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::permissions::PermissionsPermissionsRequestScreenRecordingResponse, ()> {
        map_response!(self.model(EngineMethod::PermissionsRequestScreenRecording, json!({})), apis::permissions::PermissionsPermissionsRequestScreenRecordingResponse::Status200_ActionResult, apis::permissions::PermissionsPermissionsRequestScreenRecordingResponse::Status400_EngineBadRequestErrorResponseBody, apis::permissions::PermissionsPermissionsRequestScreenRecordingResponse::Status500_EngineRuntimeErrorResponseBody)
    }
}

#[async_trait]
impl apis::sources::Sources<()> for NativeFoundationApi {
    type Claims = ();
    async fn sources_sources_list(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::sources::SourcesSourcesListResponse, ()> {
        map_response!(
            self.model(EngineMethod::SourcesList, json!({})),
            apis::sources::SourcesSourcesListResponse::Status200_SourcesResult,
            apis::sources::SourcesSourcesListResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::sources::SourcesSourcesListResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
}

#[async_trait]
impl apis::agent::Agent<()> for NativeFoundationApi {
    type Claims = ();
    async fn agent_agent_apply(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        path: &models::AgentAgentApplyPathParams,
        body: &models::AgentApplyPayload,
    ) -> Result<apis::agent::AgentAgentApplyResponse, ()> {
        let mut params = params_from_body(body).unwrap_or_else(|_| json!({}));
        if let Value::Object(ref mut object) = params {
            object.insert("jobId".to_string(), json!(path.job_id));
        }
        map_response!(
            self.model(EngineMethod::AgentApply, params),
            apis::agent::AgentAgentApplyResponse::Status200_ActionResult,
            apis::agent::AgentAgentApplyResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::agent::AgentAgentApplyResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn agent_agent_preflight(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::AgentPreflightPayload,
    ) -> Result<apis::agent::AgentAgentPreflightResponse, ()> {
        map_response!(
            params_from_body(body)
                .and_then(|params| self.model(EngineMethod::AgentPreflight, params)),
            apis::agent::AgentAgentPreflightResponse::Status200_AgentPreflightResult,
            apis::agent::AgentAgentPreflightResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::agent::AgentAgentPreflightResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn agent_agent_run(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::AgentRunPayload,
    ) -> Result<apis::agent::AgentAgentRunResponse, ()> {
        map_response!(
            params_from_body(body).and_then(|params| self.model(EngineMethod::AgentRun, params)),
            apis::agent::AgentAgentRunResponse::Status200_AgentRunResult,
            apis::agent::AgentAgentRunResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::agent::AgentAgentRunResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn agent_agent_status(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        path: &models::AgentAgentStatusPathParams,
    ) -> Result<apis::agent::AgentAgentStatusResponse, ()> {
        map_response!(
            self.model(EngineMethod::AgentStatus, params_with_job_id(&path.job_id)),
            apis::agent::AgentAgentStatusResponse::Status200_AgentRunSummary,
            apis::agent::AgentAgentStatusResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::agent::AgentAgentStatusResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
}

#[async_trait]
impl apis::export::Export<()> for NativeFoundationApi {
    type Claims = ();
    async fn export_export_get(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        path: &models::ExportExportGetPathParams,
    ) -> Result<apis::export::ExportExportGetResponse, ()> {
        let result: Result<models::ExportRunResult, models::EngineBadRequestError> =
            serde_json::from_value(json!({
                "jobId": path.job_id,
                "status": "succeeded",
            }))
            .map_err(|error| {
                bad_request(
                    "runtime_error",
                    format!("Engine response did not match contract: {error}"),
                )
            });
        map_response!(
            result,
            apis::export::ExportExportGetResponse::Status200_ExportRunResult,
            apis::export::ExportExportGetResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::export::ExportExportGetResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn export_export_info(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::export::ExportExportInfoResponse, ()> {
        map_response!(
            self.model(EngineMethod::ExportInfo, json!({})),
            apis::export::ExportExportInfoResponse::Status200_ExportInfoResult,
            apis::export::ExportExportInfoResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::export::ExportExportInfoResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn export_export_run(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::ExportRunPayload,
    ) -> Result<apis::export::ExportExportRunResponse, ()> {
        map_response!(
            params_from_body(body).and_then(|params| self.model(EngineMethod::ExportRun, params)),
            apis::export::ExportExportRunResponse::Status200_ExportRunResult,
            apis::export::ExportExportRunResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::export::ExportExportRunResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn export_export_run_cut_plan(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::ExportRunCutPlanPayload,
    ) -> Result<apis::export::ExportExportRunCutPlanResponse, ()> {
        map_response!(params_from_body(body).and_then(|params| self.model(EngineMethod::ExportRunCutPlan, params)), apis::export::ExportExportRunCutPlanResponse::Status200_ExportRunCutPlanResult, apis::export::ExportExportRunCutPlanResponse::Status400_EngineBadRequestErrorResponseBody, apis::export::ExportExportRunCutPlanResponse::Status500_EngineRuntimeErrorResponseBody)
    }
}

#[async_trait]
impl apis::project::Project<()> for NativeFoundationApi {
    type Claims = ();
    async fn project_project_current(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
    ) -> Result<apis::project::ProjectProjectCurrentResponse, ()> {
        map_response!(self.model(EngineMethod::ProjectCurrent, json!({})), apis::project::ProjectProjectCurrentResponse::Status200_ProjectState, apis::project::ProjectProjectCurrentResponse::Status400_EngineBadRequestErrorResponseBody, apis::project::ProjectProjectCurrentResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn project_project_open(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::ProjectOpenPayload,
    ) -> Result<apis::project::ProjectProjectOpenResponse, ()> {
        map_response!(
            params_from_body(body).and_then(|params| self.model(EngineMethod::ProjectOpen, params)),
            apis::project::ProjectProjectOpenResponse::Status200_ProjectState,
            apis::project::ProjectProjectOpenResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::project::ProjectProjectOpenResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
    async fn project_project_recents(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        query: &models::ProjectProjectRecentsQueryParams,
    ) -> Result<apis::project::ProjectProjectRecentsResponse, ()> {
        let params =
            json!({ "limit": query.limit.as_deref().and_then(|value| value.parse::<u64>().ok()) });
        map_response!(self.model(EngineMethod::ProjectRecents, params), apis::project::ProjectProjectRecentsResponse::Status200_ProjectRecentsResult, apis::project::ProjectProjectRecentsResponse::Status400_EngineBadRequestErrorResponseBody, apis::project::ProjectProjectRecentsResponse::Status500_EngineRuntimeErrorResponseBody)
    }
    async fn project_project_save(
        &self,
        _: &Method,
        _: &headers::Host,
        _: &axum_extra::extract::CookieJar,
        _: &Self::Claims,
        body: &models::ProjectSavePayload,
    ) -> Result<apis::project::ProjectProjectSaveResponse, ()> {
        map_response!(
            params_from_body(body).and_then(|params| self.model(EngineMethod::ProjectSave, params)),
            apis::project::ProjectProjectSaveResponse::Status200_ProjectState,
            apis::project::ProjectProjectSaveResponse::Status400_EngineBadRequestErrorResponseBody,
            apis::project::ProjectProjectSaveResponse::Status500_EngineRuntimeErrorResponseBody
        )
    }
}

fn is_loopback_host(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "127.0.0.1" | "localhost" | "::1" | "[::1]"
    )
}

fn host_header_hostname(value: &str) -> &str {
    if let Some(rest) = value.strip_prefix('[') {
        return rest.split(']').next().unwrap_or("");
    }
    value.split(':').next().unwrap_or("")
}

fn origin_allowed(value: Option<&HeaderValue>) -> bool {
    let Some(value) = value.and_then(|value| value.to_str().ok()) else {
        return true;
    };
    if value == "null" {
        return true;
    }
    let Ok(url) = url::Url::parse(value) else {
        return false;
    };
    url.scheme() == "http" && url.host_str().is_some_and(is_loopback_host)
}

fn sec_fetch_site_allowed(value: Option<&HeaderValue>) -> bool {
    let Some(value) = value.and_then(|value| value.to_str().ok()) else {
        return true;
    };
    matches!(value, "same-origin" | "same-site" | "none")
}

async fn local_request_guard(request: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    if let Some(host) = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
    {
        if !is_loopback_host(host_header_hostname(host)) {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    if !origin_allowed(request.headers().get(header::ORIGIN)) {
        return Err(StatusCode::FORBIDDEN);
    }
    if !sec_fetch_site_allowed(request.headers().get("sec-fetch-site")) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(request).await)
}

pub fn run_engine(config: EngineRuntimeConfig) {
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!("engine http runtime startup failed: {error}");
            std::process::exit(1);
        }
    };
    if let Err(error) = runtime.block_on(run_http_engine(config)) {
        eprintln!("engine http transport failed: {error}");
        std::process::exit(1);
    }
}

fn http_app(config: EngineRuntimeConfig, bearer_token: String) -> Router {
    let api = NativeFoundationApi::new(config, bearer_token);
    server::new(api)
        .layer(RequestBodyLimitLayer::new(MAX_HTTP_BODY_BYTES))
        .layer(middleware::from_fn(local_request_guard))
}

fn readiness_envelope(port: u16) -> Value {
    json!({
        "type": "guerillaglass.engine.http.ready",
        "host": "127.0.0.1",
        "port": port,
    })
}

async fn run_http_engine(
    config: EngineRuntimeConfig,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if std::env::var("GG_ENGINE_TRANSPORT").as_deref() != Ok("http") {
        return Err("GG_ENGINE_TRANSPORT must be http".into());
    }
    let bearer_token = std::env::var("GG_ENGINE_HTTP_AUTH_TOKEN")?;
    if bearer_token.is_empty() {
        return Err("GG_ENGINE_HTTP_AUTH_TOKEN must be non-empty".into());
    }
    let app = http_app(config, bearer_token);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    println!("{}", readiness_envelope(address.port()));
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body;
    use http::Request;
    use serde_json::Value;
    use std::path::PathBuf;
    use tower::ServiceExt;

    fn config() -> EngineRuntimeConfig {
        EngineRuntimeConfig {
            platform: "linux",
            recents_index_path: PathBuf::from("/tmp/guerillaglass-transport-test-recents.json"),
        }
    }

    fn request_builder(method: &str, uri: &str) -> http::request::Builder {
        Request::builder()
            .method(method)
            .uri(uri)
            .header("host", "127.0.0.1")
            .header("authorization", "Bearer test-token")
    }

    #[tokio::test]
    async fn http_transport_requires_configured_bearer_token() {
        let response = http_app(config(), "test-token".to_string())
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/system/ping")
                    .header("host", "127.0.0.1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn http_transport_rejects_non_loopback_host_and_origin() {
        for (header_name, header_value) in [
            ("host", "example.com"),
            ("origin", "https://example.com"),
            ("sec-fetch-site", "cross-site"),
        ] {
            let builder = if header_name == "host" {
                Request::builder()
                    .method("GET")
                    .uri("/v1/system/ping")
                    .header("host", header_value)
                    .header("authorization", "Bearer test-token")
            } else {
                request_builder("GET", "/v1/system/ping").header(header_name, header_value)
            };
            let response = http_app(config(), "test-token".to_string())
                .oneshot(builder.body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::FORBIDDEN, "{header_name}");
        }
    }

    async fn authorized_json(method: &str, uri: &str, body: Body) -> (StatusCode, Value) {
        let response = http_app(config(), "test-token".to_string())
            .oneshot(request_builder(method, uri).body(body).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        (status, json)
    }

    #[tokio::test]
    async fn http_transport_serves_real_system_endpoints() {
        let (ping_status, ping) = authorized_json("GET", "/v1/system/ping", Body::empty()).await;
        assert_eq!(ping_status, StatusCode::OK);
        assert_eq!(ping["app"], "guerillaglass");
        assert_eq!(ping["platform"], "linux");
        assert_eq!(ping["protocolVersion"], "2");

        let (capabilities_status, capabilities) =
            authorized_json("GET", "/v1/engine/capabilities", Body::empty()).await;
        assert_eq!(capabilities_status, StatusCode::OK);
        assert_eq!(capabilities["platform"], "linux");
        assert_eq!(capabilities["phase"], "foundation");
        assert_eq!(capabilities["capture"]["display"], true);
        assert_eq!(capabilities["agent"]["localOnly"], true);
    }

    #[tokio::test]
    async fn http_transport_serves_real_permissions_endpoints() {
        let (permissions_status, permissions) =
            authorized_json("GET", "/v1/permissions", Body::empty()).await;
        assert_eq!(permissions_status, StatusCode::OK);
        assert_eq!(permissions["screenRecordingGranted"], true);
        assert_eq!(permissions["microphoneGranted"], true);
        assert_eq!(permissions["inputMonitoring"], "authorized");

        for uri in [
            "/v1/permissions/screen-recording/request",
            "/v1/permissions/microphone/request",
            "/v1/permissions/input-monitoring/request",
            "/v1/permissions/input-monitoring/open-settings",
        ] {
            let (status, action) = authorized_json("POST", uri, Body::empty()).await;
            assert_eq!(status, StatusCode::OK, "{uri}");
            assert_eq!(action["success"], true, "{uri}");
            assert!(
                action["message"]
                    .as_str()
                    .is_some_and(|message| message.contains("Permission flow wiring")),
                "{uri}"
            );
        }
    }

    #[tokio::test]
    async fn http_transport_installs_request_body_limit() {
        let oversized_body = format!(
            r#"{{"displayId":1,"enableMic":false,"enablePreview":false,"captureFps":30,"padding":"{}"}}"#,
            "x".repeat(MAX_HTTP_BODY_BYTES + 1),
        );
        let response = http_app(config(), "test-token".to_string())
            .oneshot(
                request_builder("POST", "/v1/capture/start-display")
                    .header("content-type", "application/json")
                    .body(Body::from(oversized_body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn http_transport_maps_handler_errors_to_bad_request_response() {
        let response = http_app(config(), "test-token".to_string())
            .oneshot(
                request_builder("POST", "/v1/recording/start")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"trackInputEvents":true}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let bytes = body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["code"], "invalid_params");
        assert_eq!(json["message"], "Start capture before recording");
    }

    #[test]
    fn readiness_envelope_reports_loopback_host_and_port() {
        let envelope = readiness_envelope(49152);
        assert_eq!(envelope["type"], "guerillaglass.engine.http.ready");
        assert_eq!(envelope["host"], "127.0.0.1");
        assert_eq!(envelope["port"], 49152);
    }
}
