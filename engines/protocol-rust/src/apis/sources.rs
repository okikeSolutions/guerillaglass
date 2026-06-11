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
pub enum SourcesSourcesListResponse {
    /// SourcesResult
    Status200_SourcesResult(models::SourcesResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::AgentAgentPreflight401Response),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

/// Sources
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Sources<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// SourcesSourcesList - GET /v1/sources
    async fn sources_sources_list(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<SourcesSourcesListResponse, E>;
}
