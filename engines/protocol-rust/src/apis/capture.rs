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
pub enum CaptureCapturePreviewFrameResponse {
    /// CapturePreviewFrameResult
    Status200_CapturePreviewFrameResult(models::CapturePreviewFrameResult),
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
pub enum CaptureCaptureStartCurrentWindowResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult(models::CaptureStatusResult),
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
pub enum CaptureCaptureStartDisplayResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult(models::CaptureStatusResult),
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
pub enum CaptureCaptureStartWindowResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult(models::CaptureStatusResult),
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
pub enum CaptureCaptureStatusResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult(models::CaptureStatusResult),
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
pub enum CaptureCaptureStopResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult(models::CaptureStatusResult),
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

/// Capture
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Capture<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// CaptureCapturePreviewFrame - GET /v1/capture/preview-frame
    async fn capture_capture_preview_frame(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<CaptureCapturePreviewFrameResponse, E>;

    /// CaptureCaptureStartCurrentWindow - POST /v1/capture/start-current-window
    async fn capture_capture_start_current_window(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::CaptureStartCurrentWindowPayload,
    ) -> Result<CaptureCaptureStartCurrentWindowResponse, E>;

    /// CaptureCaptureStartDisplay - POST /v1/capture/start-display
    async fn capture_capture_start_display(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::CaptureStartDisplayPayload,
    ) -> Result<CaptureCaptureStartDisplayResponse, E>;

    /// CaptureCaptureStartWindow - POST /v1/capture/start-window
    async fn capture_capture_start_window(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::CaptureStartWindowPayload,
    ) -> Result<CaptureCaptureStartWindowResponse, E>;

    /// CaptureCaptureStatus - GET /v1/capture/status
    async fn capture_capture_status(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<CaptureCaptureStatusResponse, E>;

    /// CaptureCaptureStop - POST /v1/capture/stop
    async fn capture_capture_stop(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<CaptureCaptureStopResponse, E>;
}
