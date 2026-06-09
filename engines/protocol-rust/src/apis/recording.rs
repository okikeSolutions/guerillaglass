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
pub enum RecordingRecordingStartResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult
    (models::CaptureStatusResult)
    ,
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody
    (models::EngineBadRequestError)
    ,
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody
    (models::AgentAgentPreflight401Response)
    ,
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody
    (models::EngineForbiddenError)
    ,
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody
    (models::EngineConflictError)
    ,
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody
    (models::EngineUnprocessableError)
    ,
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody
    (models::EngineRuntimeError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum RecordingRecordingStopResponse {
    /// CaptureStatusResult
    Status200_CaptureStatusResult
    (models::CaptureStatusResult)
    ,
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody
    (models::EngineBadRequestError)
    ,
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody
    (models::AgentAgentPreflight401Response)
    ,
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody
    (models::EngineForbiddenError)
    ,
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody
    (models::EngineConflictError)
    ,
    /// EngineUnprocessableError response body.
    Status422_EngineUnprocessableErrorResponseBody
    (models::EngineUnprocessableError)
    ,
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody
    (models::EngineRuntimeError)
}




/// Recording
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Recording<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// RecordingRecordingStart - POST /v1/recording/start
    async fn recording_recording_start(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
            body: &models::RecordingStartPayload,
    ) -> Result<RecordingRecordingStartResponse, E>;

    /// RecordingRecordingStop - POST /v1/recording/stop
    async fn recording_recording_stop(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<RecordingRecordingStopResponse, E>;
}
