use async_trait::async_trait;
use axum::extract::*;
use axum_extra::extract::CookieJar;
use bytes::Bytes;
use headers::Host;
use http::Method;
use serde::{Deserialize, Serialize};

use crate::{models, types::*};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum PermissionsPermissionsGetResponse {
    /// PermissionsResult
    Status200_PermissionsResult(models::PermissionsResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum PermissionsPermissionsOpenInputMonitoringSettingsResponse {
    /// ActionResult
    Status200_ActionResult(models::ActionResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody(models::EngineUnprocessableError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum PermissionsPermissionsRequestInputMonitoringResponse {
    /// ActionResult
    Status200_ActionResult(models::ActionResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody(models::EngineUnprocessableError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum PermissionsPermissionsRequestMicrophoneResponse {
    /// ActionResult
    Status200_ActionResult(models::ActionResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody(models::EngineUnprocessableError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum PermissionsPermissionsRequestScreenRecordingResponse {
    /// ActionResult
    Status200_ActionResult(models::ActionResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody(models::EngineUnprocessableError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

/// Permissions
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Permissions<E: std::fmt::Debug + Send + Sync + 'static = ()>:
    super::ErrorHandler<E>
{
    type Claims;

    /// PermissionsPermissionsGet - GET /v1/permissions
    async fn permissions_permissions_get(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<PermissionsPermissionsGetResponse, E>;

    /// PermissionsPermissionsOpenInputMonitoringSettings - POST /v1/permissions/input-monitoring/open-settings
    async fn permissions_permissions_open_input_monitoring_settings(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<PermissionsPermissionsOpenInputMonitoringSettingsResponse, E>;

    /// PermissionsPermissionsRequestInputMonitoring - POST /v1/permissions/input-monitoring/request
    async fn permissions_permissions_request_input_monitoring(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<PermissionsPermissionsRequestInputMonitoringResponse, E>;

    /// PermissionsPermissionsRequestMicrophone - POST /v1/permissions/microphone/request
    async fn permissions_permissions_request_microphone(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<PermissionsPermissionsRequestMicrophoneResponse, E>;

    /// PermissionsPermissionsRequestScreenRecording - POST /v1/permissions/screen-recording/request
    async fn permissions_permissions_request_screen_recording(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<PermissionsPermissionsRequestScreenRecordingResponse, E>;
}
