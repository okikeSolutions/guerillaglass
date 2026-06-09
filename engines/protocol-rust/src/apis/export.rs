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
pub enum ExportExportGetResponse {
    /// ExportRunResult
    Status200_ExportRunResult
    (models::ExportRunResult)
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

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum ExportExportInfoResponse {
    /// ExportInfoResult
    Status200_ExportInfoResult
    (models::ExportInfoResult)
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
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody
    (models::EngineRuntimeError)
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum ExportExportRunResponse {
    /// ExportRunResult
    Status200_ExportRunResult
    (models::ExportRunResult)
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
pub enum ExportExportRunCutPlanResponse {
    /// ExportRunCutPlanResult
    Status200_ExportRunCutPlanResult
    (models::ExportRunCutPlanResult)
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




/// Export
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Export<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// ExportExportGet - GET /v1/exports/{jobId}
    async fn export_export_get(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
      path_params: &models::ExportExportGetPathParams,
    ) -> Result<ExportExportGetResponse, E>;

    /// ExportExportInfo - GET /v1/export/info
    async fn export_export_info(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<ExportExportInfoResponse, E>;

    /// ExportExportRun - POST /v1/exports
    async fn export_export_run(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
            body: &models::ExportRunPayload,
    ) -> Result<ExportExportRunResponse, E>;

    /// ExportExportRunCutPlan - POST /v1/exports/from-cut-plan
    async fn export_export_run_cut_plan(
    &self,
    
    method: &Method,
    host: &Host,
    cookies: &CookieJar,
        claims: &Self::Claims,
            body: &models::ExportRunCutPlanPayload,
    ) -> Result<ExportExportRunCutPlanResponse, E>;
}
