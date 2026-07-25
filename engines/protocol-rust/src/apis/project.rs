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
pub enum ProjectProjectCurrentResponse {
    /// ProjectState
    Status200_ProjectState(models::ProjectState),
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
pub enum ProjectProjectOpenResponse {
    /// ProjectState
    Status200_ProjectState(models::ProjectState),
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
pub enum ProjectProjectRecentsResponse {
    /// ProjectRecentsResult
    Status200_ProjectRecentsResult(models::ProjectRecentsResult),
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
pub enum ProjectProjectSaveResponse {
    /// ProjectState
    Status200_ProjectState(models::ProjectState),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

/// Project
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Project<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// ProjectProjectCurrent - GET /v1/project/current
    async fn project_project_current(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<ProjectProjectCurrentResponse, E>;

    /// ProjectProjectOpen - POST /v1/project/open
    async fn project_project_open(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::ProjectOpenPayload,
    ) -> Result<ProjectProjectOpenResponse, E>;

    /// ProjectProjectRecents - GET /v1/project/recents
    async fn project_project_recents(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        query_params: &models::ProjectProjectRecentsQueryParams,
    ) -> Result<ProjectProjectRecentsResponse, E>;

    /// ProjectProjectSave - POST /v1/project/save
    async fn project_project_save(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::ProjectSavePayload,
    ) -> Result<ProjectProjectSaveResponse, E>;
}
