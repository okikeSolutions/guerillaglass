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
pub enum AgentAgentApplyResponse {
    /// ActionResult
    Status200_ActionResult
    (models::ActionResult)
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
    /// EngineNotFoundError response body.
    Status404_EngineNotFoundErrorResponseBody
    (models::EngineNotFoundError)
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
pub enum AgentAgentPreflightResponse {
    /// AgentPreflightResult
    Status200_AgentPreflightResult
    (models::AgentPreflightResult)
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
pub enum AgentAgentRunResponse {
    /// AgentRunResult
    Status200_AgentRunResult
    (models::AgentRunResult)
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
pub enum AgentAgentStatusResponse {
    /// AgentRunSummary
    Status200_AgentRunSummary
    (models::AgentRunSummary)
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
    /// EngineNotFoundError response body.
    Status404_EngineNotFoundErrorResponseBody
    (models::EngineNotFoundError)
    ,
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody
    (models::EngineRuntimeError)
}




/// Agent
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Agent<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// AgentAgentApply - POST /v1/agent/runs/{jobId}/apply
    async fn agent_agent_apply(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
      path_params: &models::AgentAgentApplyPathParams,
            body: &models::AgentApplyPayload,
    ) -> Result<AgentAgentApplyResponse, E>;

    /// AgentAgentPreflight - POST /v1/agent/preflight
    async fn agent_agent_preflight(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
            body: &models::AgentPreflightPayload,
    ) -> Result<AgentAgentPreflightResponse, E>;

    /// AgentAgentRun - POST /v1/agent/runs
    async fn agent_agent_run(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
            body: &models::AgentRunPayload,
    ) -> Result<AgentAgentRunResponse, E>;

    /// AgentAgentStatus - GET /v1/agent/runs/{jobId}
    async fn agent_agent_status(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
      path_params: &models::AgentAgentStatusPathParams,
    ) -> Result<AgentAgentStatusResponse, E>;
}
