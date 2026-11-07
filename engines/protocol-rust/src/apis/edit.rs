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
pub enum EditApplyResponse {
    /// EditReview
    Status200_EditReview(models::EditReview),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum EditExportProjectResponse {
    /// ExportRunResult
    Status200_ExportRunResult(models::ExportRunResult),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum EditReviewResponse {
    /// EditReview
    Status200_EditReview(models::EditReview),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[must_use]
#[allow(clippy::large_enum_variant)]
pub enum EditValidateResponse {
    /// EditReview
    Status200_EditReview(models::EditReview),
    /// EngineBadRequestError response body.
    Status400_EngineBadRequestErrorResponseBody(models::EngineBadRequestError),
    /// EngineUnauthorizedError response body.
    Status401_EngineUnauthorizedErrorResponseBody(models::EngineUnauthorizedError),
    /// EngineForbiddenError response body.
    Status403_EngineForbiddenErrorResponseBody(models::EngineForbiddenError),
    /// EngineConflictError response body.
    Status409_EngineConflictErrorResponseBody(models::EngineConflictError),
    /// EngineRuntimeError response body.
    Status500_EngineRuntimeErrorResponseBody(models::EngineRuntimeError),
}

/// Edit
#[async_trait]
#[allow(clippy::ptr_arg)]
pub trait Edit<E: std::fmt::Debug + Send + Sync + 'static = ()>: super::ErrorHandler<E> {
    type Claims;

    /// EditApply - POST /v1/edit/apply
    async fn edit_apply(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::EditPlan,
    ) -> Result<EditApplyResponse, E>;

    /// EditExportProject - POST /v1/edit/export
    async fn edit_export_project(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::EditExportRequest,
    ) -> Result<EditExportProjectResponse, E>;

    /// EditReview - GET /v1/edit/review
    async fn edit_review(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
    ) -> Result<EditReviewResponse, E>;

    /// EditValidate - POST /v1/edit/validate
    async fn edit_validate(
        &self,

        method: &Method,
        host: &Host,
        cookies: &CookieJar,
        claims: &Self::Claims,
        body: &models::EditPlan,
    ) -> Result<EditValidateResponse, E>;
}
