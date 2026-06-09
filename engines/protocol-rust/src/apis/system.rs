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
pub enum SystemEngineCapabilitiesResponse {
    /// CapabilitiesResult
    Status200_CapabilitiesResult(models::CapabilitiesResult),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum SystemSystemPingResponse {
    /// PingResult
    Status200_PingResult(models::PingResult),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

/// System
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait System<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// SystemEngineCapabilities - GET /v1/engine/capabilities
    async fn system_engine_capabilities(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<SystemEngineCapabilitiesResponse, E>;

    /// SystemSystemPing - GET /v1/system/ping
    async fn system_system_ping(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<SystemSystemPingResponse, E>;
}
