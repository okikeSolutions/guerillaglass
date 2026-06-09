use async_trait::async_trait;
use axum::{body, body::Body, http::{Request, StatusCode}};
use protocol_rust::{apis, models, server};
use tower::ServiceExt;

const CAPTURE_START_DISPLAY_REQUEST: &str = include_str!("../../../docs/fixtures/engine-contract-v2/golden/capture-start-display.request.json");
const CAPTURE_STATUS_RESPONSE: &str = include_str!("../../../docs/fixtures/engine-contract-v2/golden/capture-status.response.json");

#[derive(Clone)]
struct MockApi;

impl AsRef<MockApi> for MockApi {
    fn as_ref(&self) -> &MockApi { self }
}

impl apis::ErrorHandler<()> for MockApi {}

#[async_trait]
impl apis::ApiAuthBasic for MockApi {
    type Claims = ();

    async fn extract_claims_from_auth_header(
        &self,
        kind: apis::BasicAuthKind,
        headers: &axum::http::header::HeaderMap,
        key: &str,
    ) -> Option<Self::Claims> {
        let value = headers.get(key)?.to_str().ok()?;
        (kind == apis::BasicAuthKind::Bearer && value == "Bearer test-token").then_some(())
    }
}

fn capture_status() -> models::CaptureStatusResult {
    let mut telemetry = models::CaptureTelemetry::new();
    telemetry.source_dropped_frames = Some(0);
    telemetry.writer_dropped_frames = Some(0);
    telemetry.writer_backpressure_drops = Some(0);
    telemetry.achieved_fps = Some(30.0);
    telemetry.capture_callback_ms = Some(0.1);
    telemetry.record_queue_lag_ms = Some(0.2);
    telemetry.writer_append_ms = Some(0.3);

    let mut status = models::CaptureStatusResult::new(true, false, 0.0, telemetry);
    status.capture_session_id = Some("capture-session-1".to_string());
    status
}

macro_rules! unused {
    () => { panic!("unused endpoint in protocol-rust server helper test") };
}

#[async_trait]
impl apis::system::System<()> for MockApi {
    type Claims = ();

    async fn system_engine_capabilities(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::system::SystemEngineCapabilitiesResponse, ()> { unused!() }

    async fn system_system_ping(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::system::SystemSystemPingResponse, ()> {
        Ok(apis::system::SystemSystemPingResponse::Status200_PingResult(models::PingResult::new(
            "guerillaglass".to_string(),
            "0.0.0-test".to_string(),
            "2".to_string(),
            "test".to_string(),
        )))
    }
}

#[async_trait]
impl apis::capture::Capture<()> for MockApi {
    type Claims = ();

    async fn capture_capture_preview_frame(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::capture::CaptureCapturePreviewFrameResponse, ()> { unused!() }
    async fn capture_capture_start_current_window(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::CaptureStartCurrentWindowPayload) -> Result<apis::capture::CaptureCaptureStartCurrentWindowResponse, ()> { unused!() }
    async fn capture_capture_start_display(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, body: &models::CaptureStartDisplayPayload) -> Result<apis::capture::CaptureCaptureStartDisplayResponse, ()> {
        assert_eq!(body.enable_mic, Some(true));
        assert_eq!(body.enable_preview, Some(true));
        assert_eq!(body.capture_fps, Some(30.0));
        if body.display_id == Some(400) {
            return Ok(apis::capture::CaptureCaptureStartDisplayResponse::Status400_EngineBadRequestErrorResponseBody(
                models::EngineBadRequestError::new("bad_request".to_string(), "Invalid display.".to_string()),
            ));
        }
        Ok(apis::capture::CaptureCaptureStartDisplayResponse::Status200_CaptureStatusResult(capture_status()))
    }
    async fn capture_capture_start_window(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::CaptureStartWindowPayload) -> Result<apis::capture::CaptureCaptureStartWindowResponse, ()> { unused!() }
    async fn capture_capture_status(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::capture::CaptureCaptureStatusResponse, ()> { Ok(apis::capture::CaptureCaptureStatusResponse::Status200_CaptureStatusResult(capture_status())) }
    async fn capture_capture_stop(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::capture::CaptureCaptureStopResponse, ()> { unused!() }
}

#[async_trait]
impl apis::agent::Agent<()> for MockApi {
    type Claims = ();
    async fn agent_agent_apply(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::AgentAgentApplyPathParams, _: &models::AgentApplyPayload) -> Result<apis::agent::AgentAgentApplyResponse, ()> { unused!() }
    async fn agent_agent_preflight(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::AgentPreflightPayload) -> Result<apis::agent::AgentAgentPreflightResponse, ()> { unused!() }
    async fn agent_agent_run(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::AgentRunPayload) -> Result<apis::agent::AgentAgentRunResponse, ()> { unused!() }
    async fn agent_agent_status(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::AgentAgentStatusPathParams) -> Result<apis::agent::AgentAgentStatusResponse, ()> { unused!() }
}

#[async_trait]
impl apis::export::Export<()> for MockApi {
    type Claims = ();
    async fn export_export_get(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ExportExportGetPathParams) -> Result<apis::export::ExportExportGetResponse, ()> { unused!() }
    async fn export_export_info(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::export::ExportExportInfoResponse, ()> { unused!() }
    async fn export_export_run(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ExportRunPayload) -> Result<apis::export::ExportExportRunResponse, ()> { unused!() }
    async fn export_export_run_cut_plan(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ExportRunCutPlanPayload) -> Result<apis::export::ExportExportRunCutPlanResponse, ()> { unused!() }
}

#[async_trait]
impl apis::permissions::Permissions<()> for MockApi {
    type Claims = ();
    async fn permissions_permissions_get(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::permissions::PermissionsPermissionsGetResponse, ()> { unused!() }
    async fn permissions_permissions_open_input_monitoring_settings(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::permissions::PermissionsPermissionsOpenInputMonitoringSettingsResponse, ()> { unused!() }
    async fn permissions_permissions_request_input_monitoring(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::permissions::PermissionsPermissionsRequestInputMonitoringResponse, ()> { unused!() }
    async fn permissions_permissions_request_microphone(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::permissions::PermissionsPermissionsRequestMicrophoneResponse, ()> { unused!() }
    async fn permissions_permissions_request_screen_recording(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::permissions::PermissionsPermissionsRequestScreenRecordingResponse, ()> { unused!() }
}

#[async_trait]
impl apis::project::Project<()> for MockApi {
    type Claims = ();
    async fn project_project_current(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::project::ProjectProjectCurrentResponse, ()> { unused!() }
    async fn project_project_open(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ProjectOpenPayload) -> Result<apis::project::ProjectProjectOpenResponse, ()> { unused!() }
    async fn project_project_recents(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ProjectProjectRecentsQueryParams) -> Result<apis::project::ProjectProjectRecentsResponse, ()> { unused!() }
    async fn project_project_save(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::ProjectSavePayload) -> Result<apis::project::ProjectProjectSaveResponse, ()> { unused!() }
}

#[async_trait]
impl apis::recording::Recording<()> for MockApi {
    type Claims = ();
    async fn recording_recording_start(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims, _: &models::RecordingStartPayload) -> Result<apis::recording::RecordingRecordingStartResponse, ()> { unused!() }
    async fn recording_recording_stop(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::recording::RecordingRecordingStopResponse, ()> { unused!() }
}

#[async_trait]
impl apis::sources::Sources<()> for MockApi {
    type Claims = ();
    async fn sources_sources_list(&self, _: &http::Method, _: &headers::Host, _: &axum_extra::extract::CookieJar, _: &Self::Claims) -> Result<apis::sources::SourcesSourcesListResponse, ()> { unused!() }
}

async fn send(request: Request<Body>) -> axum::response::Response {
    server::new(MockApi).oneshot(request).await.unwrap()
}

fn request_builder(method: &str, uri: &str) -> http::request::Builder {
    Request::builder().method(method).uri(uri).header("host", "127.0.0.1")
}

#[tokio::test]
async fn generated_server_rejects_missing_bearer_auth() {
    let response = send(request_builder("GET", "/v1/system/ping").body(Body::empty()).unwrap()).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn generated_server_dispatches_and_encodes_success_response() {
    let response = send(
        request_builder("GET", "/v1/system/ping")
            .header("authorization", "Bearer test-token")
            .body(Body::empty())
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["app"], "guerillaglass");
    assert_eq!(json["protocolVersion"], "2");
}

#[tokio::test]
async fn generated_server_decodes_json_request_body_and_encodes_status_response() {
    let response = send(
        request_builder("POST", "/v1/capture/start-display")
            .header("authorization", "Bearer test-token")
            .header("content-type", "application/json")
            .body(Body::from(CAPTURE_START_DISPLAY_REQUEST))
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["isRunning"], true);
    assert_eq!(json["captureSessionId"], "capture-session-1");
    assert!(!json.to_string().contains("null"));
}

#[test]
fn generated_models_decode_and_encode_golden_capture_fixtures() {
    let request: models::CaptureStartDisplayPayload = serde_json::from_str(CAPTURE_START_DISPLAY_REQUEST).unwrap();
    assert_eq!(request.display_id, Some(1));
    assert_eq!(request.capture_fps, Some(30.0));

    let status: models::CaptureStatusResult = serde_json::from_str(CAPTURE_STATUS_RESPONSE).unwrap();
    assert_eq!(status.capture_session_id.as_deref(), Some("capture-session-1"));
    assert_eq!(status.telemetry.achieved_fps, Some(30.0));

    let encoded = serde_json::to_value(status).unwrap();
    assert_eq!(encoded["isRunning"], true);
    assert_eq!(encoded["captureSessionId"], "capture-session-1");
    assert!(!encoded.to_string().contains("null"));
}

#[tokio::test]
async fn generated_server_rejects_malformed_json_request_body() {
    let response = send(
        request_builder("POST", "/v1/capture/start-display")
            .header("authorization", "Bearer test-token")
            .header("content-type", "application/json")
            .body(Body::from("not-json"))
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn generated_server_rejects_request_body_over_default_axum_limit() {
    let oversized_body = format!(
        r#"{{"displayId":1,"enableMic":true,"enablePreview":true,"captureFps":30,"padding":"{}"}}"#,
        "x".repeat(2 * 1024 * 1024),
    );
    let response = send(
        request_builder("POST", "/v1/capture/start-display")
            .header("authorization", "Bearer test-token")
            .header("content-type", "application/json")
            .body(Body::from(oversized_body))
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn generated_server_encodes_declared_bad_request_response() {
    let response = send(
        request_builder("POST", "/v1/capture/start-display")
            .header("authorization", "Bearer test-token")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"displayId":400,"enableMic":true,"enablePreview":true,"captureFps":30}"#))
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let bytes = body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "bad_request");
    assert_eq!(json["message"], "Invalid display.");
}

#[tokio::test]
async fn generated_server_reports_unsupported_route() {
    let response = send(
        request_builder("GET", "/v1/does-not-exist")
            .header("authorization", "Bearer test-token")
            .body(Body::empty())
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn generated_server_reports_unsupported_method() {
    let response = send(
        request_builder("POST", "/v1/system/ping")
            .header("authorization", "Bearer test-token")
            .body(Body::empty())
            .unwrap(),
    ).await;
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}
