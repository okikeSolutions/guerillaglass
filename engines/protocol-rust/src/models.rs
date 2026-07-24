#![allow(unused_qualifications)]

use http::HeaderValue;
use validator::Validate;

#[cfg(feature = "server")]
use crate::header;
use crate::{models, types::*};

#[allow(dead_code)]
fn from_validation_error(e: validator::ValidationError) -> validator::ValidationErrors {
    let mut errs = validator::ValidationErrors::new();
    errs.add("na", e);
    errs
}

#[allow(dead_code)]
pub fn check_xss_string(v: &str) -> std::result::Result<(), validator::ValidationError> {
    if ammonia::is_html(v) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_vec_string(v: &[String]) -> std::result::Result<(), validator::ValidationError> {
    if v.iter().any(|i| ammonia::is_html(i)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map_string(
    v: &std::collections::HashMap<String, String>,
) -> std::result::Result<(), validator::ValidationError> {
    if v.keys().any(|k| ammonia::is_html(k)) || v.values().any(|v| ammonia::is_html(v)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map_nested<T>(
    v: &std::collections::HashMap<String, T>,
) -> std::result::Result<(), validator::ValidationError>
where
    T: validator::Validate,
{
    if v.keys().any(|k| ammonia::is_html(k)) || v.values().any(|v| v.validate().is_err()) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[allow(dead_code)]
pub fn check_xss_map<T>(
    v: &std::collections::HashMap<String, T>,
) -> std::result::Result<(), validator::ValidationError> {
    if v.keys().any(|k| ammonia::is_html(k)) {
        std::result::Result::Err(validator::ValidationError::new("xss detected"))
    } else {
        std::result::Result::Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentAgentApplyPathParams {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentAgentStatusPathParams {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportExportGetPathParams {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectProjectRecentsQueryParams {
    #[serde(rename = "limit")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<String>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ActionResult {
    #[serde(rename = "success")]
    pub success: bool,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl ActionResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(success: bool) -> ActionResult {
        ActionResult {
            success,
            message: None,
        }
    }
}

/// Converts the ActionResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ActionResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("success".to_string()),
            Some(self.success.to_string()),
            self.message
                .as_ref()
                .map(|message| ["message".to_string(), message.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ActionResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ActionResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub success: Vec<bool>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ActionResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "success" => intermediate_rep.success.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ActionResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ActionResult {
            success: intermediate_rep
                .success
                .into_iter()
                .next()
                .ok_or_else(|| "success missing in ActionResult".to_string())?,
            message: intermediate_rep.message.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ActionResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ActionResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ActionResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ActionResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ActionResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ActionResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ActionResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
#[allow(non_camel_case_types, clippy::large_enum_variant)]
pub enum AgentAgentPreflight401Response {
    EngineUnauthorizedError(models::EngineUnauthorizedError),
    EngineUnauthorizedError1(models::EngineUnauthorizedError),
}

impl validator::Validate for AgentAgentPreflight401Response {
    fn validate(&self) -> std::result::Result<(), validator::ValidationErrors> {
        match self {
            Self::EngineUnauthorizedError(v) => v.validate(),
            Self::EngineUnauthorizedError1(v) => v.validate(),
        }
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentAgentPreflight401Response value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentAgentPreflight401Response {
    type Err = serde_json::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        serde_json::from_str(s)
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentApplyPayload {
    #[serde(rename = "destructiveIntent")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destructive_intent: Option<bool>,
}

impl AgentApplyPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> AgentApplyPayload {
        AgentApplyPayload {
            destructive_intent: None,
        }
    }
}

/// Converts the AgentApplyPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentApplyPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> =
            vec![self.destructive_intent.as_ref().map(|destructive_intent| {
                [
                    "destructiveIntent".to_string(),
                    destructive_intent.to_string(),
                ]
                .join(",")
            })];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentApplyPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentApplyPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub destructive_intent: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentApplyPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "destructiveIntent" => intermediate_rep.destructive_intent.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentApplyPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentApplyPayload {
            destructive_intent: intermediate_rep.destructive_intent.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentApplyPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentApplyPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentApplyPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentApplyPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentApplyPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentApplyPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentApplyPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentPreflightPayload {
    #[serde(rename = "runtimeBudgetMinutes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_budget_minutes: Option<i32>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "transcriptionProvider")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcription_provider: Option<String>,

    #[serde(rename = "importedTranscriptPath")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported_transcript_path: Option<String>,
}

impl AgentPreflightPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> AgentPreflightPayload {
        AgentPreflightPayload {
            runtime_budget_minutes: None,
            transcription_provider: None,
            imported_transcript_path: None,
        }
    }
}

/// Converts the AgentPreflightPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentPreflightPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.runtime_budget_minutes
                .as_ref()
                .map(|runtime_budget_minutes| {
                    [
                        "runtimeBudgetMinutes".to_string(),
                        runtime_budget_minutes.to_string(),
                    ]
                    .join(",")
                }),
            self.transcription_provider
                .as_ref()
                .map(|transcription_provider| {
                    [
                        "transcriptionProvider".to_string(),
                        transcription_provider.to_string(),
                    ]
                    .join(",")
                }),
            self.imported_transcript_path
                .as_ref()
                .map(|imported_transcript_path| {
                    [
                        "importedTranscriptPath".to_string(),
                        imported_transcript_path.to_string(),
                    ]
                    .join(",")
                }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentPreflightPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentPreflightPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub runtime_budget_minutes: Vec<i32>,
            pub transcription_provider: Vec<String>,
            pub imported_transcript_path: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentPreflightPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "runtimeBudgetMinutes" => intermediate_rep.runtime_budget_minutes.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "transcriptionProvider" => intermediate_rep.transcription_provider.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "importedTranscriptPath" => intermediate_rep.imported_transcript_path.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentPreflightPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentPreflightPayload {
            runtime_budget_minutes: intermediate_rep.runtime_budget_minutes.into_iter().next(),
            transcription_provider: intermediate_rep.transcription_provider.into_iter().next(),
            imported_transcript_path: intermediate_rep.imported_transcript_path.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentPreflightPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentPreflightPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentPreflightPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentPreflightPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentPreflightPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentPreflightPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentPreflightPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentPreflightResult {
    #[serde(rename = "ready")]
    pub ready: bool,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "blockingReasons")]
    #[validate(custom(function = "check_xss_vec_string"))]
    pub blocking_reasons: Vec<String>,

    #[serde(rename = "canApplyDestructive")]
    pub can_apply_destructive: bool,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "transcriptionProvider")]
    #[validate(custom(function = "check_xss_string"))]
    pub transcription_provider: String,

    #[serde(rename = "preflightToken")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preflight_token: Option<String>,
}

impl AgentPreflightResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        ready: bool,
        blocking_reasons: Vec<String>,
        can_apply_destructive: bool,
        transcription_provider: String,
    ) -> AgentPreflightResult {
        AgentPreflightResult {
            ready,
            blocking_reasons,
            can_apply_destructive,
            transcription_provider,
            preflight_token: None,
        }
    }
}

/// Converts the AgentPreflightResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentPreflightResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("ready".to_string()),
            Some(self.ready.to_string()),
            Some("blockingReasons".to_string()),
            Some(
                self.blocking_reasons
                    .iter()
                    .map(|x| x.to_string())
                    .collect::<Vec<_>>()
                    .join(","),
            ),
            Some("canApplyDestructive".to_string()),
            Some(self.can_apply_destructive.to_string()),
            Some("transcriptionProvider".to_string()),
            Some(self.transcription_provider.to_string()),
            self.preflight_token.as_ref().map(|preflight_token| {
                ["preflightToken".to_string(), preflight_token.to_string()].join(",")
            }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentPreflightResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentPreflightResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub ready: Vec<bool>,
            pub blocking_reasons: Vec<Vec<String>>,
            pub can_apply_destructive: Vec<bool>,
            pub transcription_provider: Vec<String>,
            pub preflight_token: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentPreflightResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "ready" => intermediate_rep.ready.push(<bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    "blockingReasons" => return std::result::Result::Err("Parsing a container in this style is not supported in AgentPreflightResult".to_string()),
                    #[allow(clippy::redundant_clone)]
                    "canApplyDestructive" => intermediate_rep.can_apply_destructive.push(<bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "transcriptionProvider" => intermediate_rep.transcription_provider.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "preflightToken" => intermediate_rep.preflight_token.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing AgentPreflightResult".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentPreflightResult {
            ready: intermediate_rep
                .ready
                .into_iter()
                .next()
                .ok_or_else(|| "ready missing in AgentPreflightResult".to_string())?,
            blocking_reasons: intermediate_rep
                .blocking_reasons
                .into_iter()
                .next()
                .ok_or_else(|| "blockingReasons missing in AgentPreflightResult".to_string())?,
            can_apply_destructive: intermediate_rep
                .can_apply_destructive
                .into_iter()
                .next()
                .ok_or_else(|| "canApplyDestructive missing in AgentPreflightResult".to_string())?,
            transcription_provider: intermediate_rep
                .transcription_provider
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "transcriptionProvider missing in AgentPreflightResult".to_string()
                })?,
            preflight_token: intermediate_rep.preflight_token.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentPreflightResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentPreflightResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentPreflightResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentPreflightResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentPreflightResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentPreflightResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentPreflightResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentQaReport {
    #[serde(rename = "passed")]
    pub passed: bool,

    #[serde(rename = "score")]
    #[validate(nested)]
    pub score: models::AgentQaReportScore,

    #[serde(rename = "coverage")]
    #[validate(nested)]
    pub coverage: models::AgentQaReportCoverage,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "missingBeats")]
    #[validate(custom(function = "check_xss_vec_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub missing_beats: Option<Vec<String>>,
}

impl AgentQaReport {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        passed: bool,
        score: models::AgentQaReportScore,
        coverage: models::AgentQaReportCoverage,
    ) -> AgentQaReport {
        AgentQaReport {
            passed,
            score,
            coverage,
            missing_beats: None,
        }
    }
}

/// Converts the AgentQaReport value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentQaReport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("passed".to_string()),
            Some(self.passed.to_string()),
            // Skipping score in query parameter serialization

            // Skipping coverage in query parameter serialization
            self.missing_beats.as_ref().map(|missing_beats| {
                [
                    "missingBeats".to_string(),
                    missing_beats
                        .iter()
                        .map(|x| x.to_string())
                        .collect::<Vec<_>>()
                        .join(","),
                ]
                .join(",")
            }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentQaReport value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentQaReport {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub passed: Vec<bool>,
            pub score: Vec<models::AgentQaReportScore>,
            pub coverage: Vec<models::AgentQaReportCoverage>,
            pub missing_beats: Vec<Vec<String>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentQaReport".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "passed" => intermediate_rep.passed.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "score" => intermediate_rep.score.push(
                        <models::AgentQaReportScore as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "coverage" => intermediate_rep.coverage.push(
                        <models::AgentQaReportCoverage as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    "missingBeats" => {
                        return std::result::Result::Err(
                            "Parsing a container in this style is not supported in AgentQaReport"
                                .to_string(),
                        );
                    }
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentQaReport".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentQaReport {
            passed: intermediate_rep
                .passed
                .into_iter()
                .next()
                .ok_or_else(|| "passed missing in AgentQaReport".to_string())?,
            score: intermediate_rep
                .score
                .into_iter()
                .next()
                .ok_or_else(|| "score missing in AgentQaReport".to_string())?,
            coverage: intermediate_rep
                .coverage
                .into_iter()
                .next()
                .ok_or_else(|| "coverage missing in AgentQaReport".to_string())?,
            missing_beats: intermediate_rep.missing_beats.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentQaReport> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentQaReport>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentQaReport>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentQaReport - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentQaReport> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentQaReport as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentQaReport - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentQaReportCoverage {
    #[serde(rename = "hook")]
    pub hook: bool,

    #[serde(rename = "action")]
    pub action: bool,

    #[serde(rename = "payoff")]
    pub payoff: bool,

    #[serde(rename = "takeaway")]
    pub takeaway: bool,
}

impl AgentQaReportCoverage {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(hook: bool, action: bool, payoff: bool, takeaway: bool) -> AgentQaReportCoverage {
        AgentQaReportCoverage {
            hook,
            action,
            payoff,
            takeaway,
        }
    }
}

/// Converts the AgentQaReportCoverage value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentQaReportCoverage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("hook".to_string()),
            Some(self.hook.to_string()),
            Some("action".to_string()),
            Some(self.action.to_string()),
            Some("payoff".to_string()),
            Some(self.payoff.to_string()),
            Some("takeaway".to_string()),
            Some(self.takeaway.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentQaReportCoverage value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentQaReportCoverage {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub hook: Vec<bool>,
            pub action: Vec<bool>,
            pub payoff: Vec<bool>,
            pub takeaway: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentQaReportCoverage".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "hook" => intermediate_rep.hook.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "action" => intermediate_rep.action.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "payoff" => intermediate_rep.payoff.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "takeaway" => intermediate_rep.takeaway.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentQaReportCoverage".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentQaReportCoverage {
            hook: intermediate_rep
                .hook
                .into_iter()
                .next()
                .ok_or_else(|| "hook missing in AgentQaReportCoverage".to_string())?,
            action: intermediate_rep
                .action
                .into_iter()
                .next()
                .ok_or_else(|| "action missing in AgentQaReportCoverage".to_string())?,
            payoff: intermediate_rep
                .payoff
                .into_iter()
                .next()
                .ok_or_else(|| "payoff missing in AgentQaReportCoverage".to_string())?,
            takeaway: intermediate_rep
                .takeaway
                .into_iter()
                .next()
                .ok_or_else(|| "takeaway missing in AgentQaReportCoverage".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentQaReportCoverage> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentQaReportCoverage>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentQaReportCoverage>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentQaReportCoverage - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentQaReportCoverage> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentQaReportCoverage as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentQaReportCoverage - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
#[allow(non_camel_case_types, clippy::large_enum_variant)]
pub enum AgentQaReportScore {
    AgentQaReportScoreAnyOf(models::AgentQaReportScoreAnyOf),
    String(String),
}

impl validator::Validate for AgentQaReportScore {
    fn validate(&self) -> std::result::Result<(), validator::ValidationErrors> {
        match self {
            Self::AgentQaReportScoreAnyOf(v) => v.validate(),
            Self::String(_) => std::result::Result::Ok(()),
        }
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentQaReportScore value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentQaReportScore {
    type Err = serde_json::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        serde_json::from_str(s)
    }
}

impl From<models::AgentQaReportScoreAnyOf> for AgentQaReportScore {
    fn from(value: models::AgentQaReportScoreAnyOf) -> Self {
        Self::AgentQaReportScoreAnyOf(value)
    }
}
impl From<String> for AgentQaReportScore {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
#[allow(non_camel_case_types, clippy::large_enum_variant)]
pub enum AgentQaReportScoreAnyOf {
    F64(f64),
    String(String),
    String1(String),
    String2(String),
}

impl validator::Validate for AgentQaReportScoreAnyOf {
    fn validate(&self) -> std::result::Result<(), validator::ValidationErrors> {
        match self {
            Self::F64(_) => std::result::Result::Ok(()),
            Self::String(_) => std::result::Result::Ok(()),
            Self::String1(_) => std::result::Result::Ok(()),
            Self::String2(_) => std::result::Result::Ok(()),
        }
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentQaReportScoreAnyOf value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentQaReportScoreAnyOf {
    type Err = serde_json::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        serde_json::from_str(s)
    }
}

impl From<f64> for AgentQaReportScoreAnyOf {
    fn from(value: f64) -> Self {
        Self::F64(value)
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentRunPayload {
    #[serde(rename = "preflightToken")]
    #[validate(custom(function = "check_xss_string"))]
    pub preflight_token: String,

    #[serde(rename = "runtimeBudgetMinutes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_budget_minutes: Option<i32>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "transcriptionProvider")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcription_provider: Option<String>,

    #[serde(rename = "importedTranscriptPath")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported_transcript_path: Option<String>,

    #[serde(rename = "force")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub force: Option<bool>,
}

impl AgentRunPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(preflight_token: String) -> AgentRunPayload {
        AgentRunPayload {
            preflight_token,
            runtime_budget_minutes: None,
            transcription_provider: None,
            imported_transcript_path: None,
            force: None,
        }
    }
}

/// Converts the AgentRunPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentRunPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("preflightToken".to_string()),
            Some(self.preflight_token.to_string()),
            self.runtime_budget_minutes
                .as_ref()
                .map(|runtime_budget_minutes| {
                    [
                        "runtimeBudgetMinutes".to_string(),
                        runtime_budget_minutes.to_string(),
                    ]
                    .join(",")
                }),
            self.transcription_provider
                .as_ref()
                .map(|transcription_provider| {
                    [
                        "transcriptionProvider".to_string(),
                        transcription_provider.to_string(),
                    ]
                    .join(",")
                }),
            self.imported_transcript_path
                .as_ref()
                .map(|imported_transcript_path| {
                    [
                        "importedTranscriptPath".to_string(),
                        imported_transcript_path.to_string(),
                    ]
                    .join(",")
                }),
            self.force
                .as_ref()
                .map(|force| ["force".to_string(), force.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentRunPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentRunPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub preflight_token: Vec<String>,
            pub runtime_budget_minutes: Vec<i32>,
            pub transcription_provider: Vec<String>,
            pub imported_transcript_path: Vec<String>,
            pub force: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentRunPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "preflightToken" => intermediate_rep.preflight_token.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "runtimeBudgetMinutes" => intermediate_rep.runtime_budget_minutes.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "transcriptionProvider" => intermediate_rep.transcription_provider.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "importedTranscriptPath" => intermediate_rep.imported_transcript_path.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "force" => intermediate_rep.force.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentRunPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentRunPayload {
            preflight_token: intermediate_rep
                .preflight_token
                .into_iter()
                .next()
                .ok_or_else(|| "preflightToken missing in AgentRunPayload".to_string())?,
            runtime_budget_minutes: intermediate_rep.runtime_budget_minutes.into_iter().next(),
            transcription_provider: intermediate_rep.transcription_provider.into_iter().next(),
            imported_transcript_path: intermediate_rep.imported_transcript_path.into_iter().next(),
            force: intermediate_rep.force.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentRunPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentRunPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentRunPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentRunPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentRunPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentRunPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentRunPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentRunResult {
    #[serde(rename = "jobId")]
    #[validate(custom(function = "check_xss_string"))]
    pub job_id: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
    #[validate(custom(function = "check_xss_string"))]
    pub status: String,
}

impl AgentRunResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(job_id: String, status: String) -> AgentRunResult {
        AgentRunResult { job_id, status }
    }
}

/// Converts the AgentRunResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentRunResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("jobId".to_string()),
            Some(self.job_id.to_string()),
            Some("status".to_string()),
            Some(self.status.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentRunResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentRunResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub job_id: Vec<String>,
            pub status: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentRunResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "jobId" => intermediate_rep.job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentRunResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentRunResult {
            job_id: intermediate_rep
                .job_id
                .into_iter()
                .next()
                .ok_or_else(|| "jobId missing in AgentRunResult".to_string())?,
            status: intermediate_rep
                .status
                .into_iter()
                .next()
                .ok_or_else(|| "status missing in AgentRunResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentRunResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentRunResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentRunResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentRunResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentRunResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentRunResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentRunResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct AgentRunSummary {
    #[serde(rename = "jobId")]
    #[validate(custom(function = "check_xss_string"))]
    pub job_id: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
    #[validate(custom(function = "check_xss_string"))]
    pub status: String,

    #[serde(rename = "runtimeBudgetMinutes")]
    pub runtime_budget_minutes: i32,

    #[serde(rename = "qaReport")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qa_report: Option<models::AgentQaReport>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "blockingReason")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocking_reason: Option<String>,

    #[serde(rename = "updatedAt")]
    #[validate(custom(function = "check_xss_string"))]
    pub updated_at: String,
}

impl AgentRunSummary {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        job_id: String,
        status: String,
        runtime_budget_minutes: i32,
        updated_at: String,
    ) -> AgentRunSummary {
        AgentRunSummary {
            job_id,
            status,
            runtime_budget_minutes,
            qa_report: None,
            blocking_reason: None,
            updated_at,
        }
    }
}

/// Converts the AgentRunSummary value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for AgentRunSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("jobId".to_string()),
            Some(self.job_id.to_string()),
            Some("status".to_string()),
            Some(self.status.to_string()),
            Some("runtimeBudgetMinutes".to_string()),
            Some(self.runtime_budget_minutes.to_string()),
            // Skipping qaReport in query parameter serialization
            self.blocking_reason.as_ref().map(|blocking_reason| {
                ["blockingReason".to_string(), blocking_reason.to_string()].join(",")
            }),
            Some("updatedAt".to_string()),
            Some(self.updated_at.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a AgentRunSummary value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for AgentRunSummary {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub job_id: Vec<String>,
            pub status: Vec<String>,
            pub runtime_budget_minutes: Vec<i32>,
            pub qa_report: Vec<models::AgentQaReport>,
            pub blocking_reason: Vec<String>,
            pub updated_at: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing AgentRunSummary".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "jobId" => intermediate_rep.job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "runtimeBudgetMinutes" => intermediate_rep.runtime_budget_minutes.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "qaReport" => intermediate_rep.qa_report.push(
                        <models::AgentQaReport as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "blockingReason" => intermediate_rep.blocking_reason.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "updatedAt" => intermediate_rep.updated_at.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing AgentRunSummary".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(AgentRunSummary {
            job_id: intermediate_rep
                .job_id
                .into_iter()
                .next()
                .ok_or_else(|| "jobId missing in AgentRunSummary".to_string())?,
            status: intermediate_rep
                .status
                .into_iter()
                .next()
                .ok_or_else(|| "status missing in AgentRunSummary".to_string())?,
            runtime_budget_minutes: intermediate_rep
                .runtime_budget_minutes
                .into_iter()
                .next()
                .ok_or_else(|| "runtimeBudgetMinutes missing in AgentRunSummary".to_string())?,
            qa_report: intermediate_rep.qa_report.into_iter().next(),
            blocking_reason: intermediate_rep.blocking_reason.into_iter().next(),
            updated_at: intermediate_rep
                .updated_at
                .into_iter()
                .next()
                .ok_or_else(|| "updatedAt missing in AgentRunSummary".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<AgentRunSummary> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<AgentRunSummary>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<AgentRunSummary>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for AgentRunSummary - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<AgentRunSummary> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <AgentRunSummary as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into AgentRunSummary - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// Versioned project-global background stage and source-card framing settings.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct BackgroundFramingSettings {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "version")]
    pub version: f64,

    #[serde(rename = "enabled")]
    pub enabled: bool,

    #[serde(rename = "backgroundColor")]
    #[validate(custom(function = "check_xss_string"))]
    pub background_color: String,

    #[serde(rename = "paddingFraction")]
    pub padding_fraction: f64,

    #[serde(rename = "cornerRadiusFraction")]
    pub corner_radius_fraction: f64,

    #[serde(rename = "shadowStrength")]
    pub shadow_strength: f64,
}

impl BackgroundFramingSettings {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        version: f64,
        enabled: bool,
        background_color: String,
        padding_fraction: f64,
        corner_radius_fraction: f64,
        shadow_strength: f64,
    ) -> BackgroundFramingSettings {
        BackgroundFramingSettings {
            version,
            enabled,
            background_color,
            padding_fraction,
            corner_radius_fraction,
            shadow_strength,
        }
    }
}

/// Converts the BackgroundFramingSettings value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for BackgroundFramingSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("version".to_string()),
            Some(self.version.to_string()),
            Some("enabled".to_string()),
            Some(self.enabled.to_string()),
            Some("backgroundColor".to_string()),
            Some(self.background_color.to_string()),
            Some("paddingFraction".to_string()),
            Some(self.padding_fraction.to_string()),
            Some("cornerRadiusFraction".to_string()),
            Some(self.corner_radius_fraction.to_string()),
            Some("shadowStrength".to_string()),
            Some(self.shadow_strength.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a BackgroundFramingSettings value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for BackgroundFramingSettings {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub version: Vec<f64>,
            pub enabled: Vec<bool>,
            pub background_color: Vec<String>,
            pub padding_fraction: Vec<f64>,
            pub corner_radius_fraction: Vec<f64>,
            pub shadow_strength: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing BackgroundFramingSettings".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "version" => intermediate_rep.version.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enabled" => intermediate_rep.enabled.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "backgroundColor" => intermediate_rep.background_color.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "paddingFraction" => intermediate_rep.padding_fraction.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "cornerRadiusFraction" => intermediate_rep.corner_radius_fraction.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "shadowStrength" => intermediate_rep.shadow_strength.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing BackgroundFramingSettings".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(BackgroundFramingSettings {
            version: intermediate_rep
                .version
                .into_iter()
                .next()
                .ok_or_else(|| "version missing in BackgroundFramingSettings".to_string())?,
            enabled: intermediate_rep
                .enabled
                .into_iter()
                .next()
                .ok_or_else(|| "enabled missing in BackgroundFramingSettings".to_string())?,
            background_color: intermediate_rep
                .background_color
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "backgroundColor missing in BackgroundFramingSettings".to_string()
                })?,
            padding_fraction: intermediate_rep
                .padding_fraction
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "paddingFraction missing in BackgroundFramingSettings".to_string()
                })?,
            corner_radius_fraction: intermediate_rep
                .corner_radius_fraction
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "cornerRadiusFraction missing in BackgroundFramingSettings".to_string()
                })?,
            shadow_strength: intermediate_rep
                .shadow_strength
                .into_iter()
                .next()
                .ok_or_else(|| "shadowStrength missing in BackgroundFramingSettings".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<BackgroundFramingSettings> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<BackgroundFramingSettings>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<BackgroundFramingSettings>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for BackgroundFramingSettings - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<BackgroundFramingSettings> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <BackgroundFramingSettings as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into BackgroundFramingSettings - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesAgent {
    #[serde(rename = "preflight")]
    pub preflight: bool,

    #[serde(rename = "run")]
    pub run: bool,

    #[serde(rename = "status")]
    pub status: bool,

    #[serde(rename = "apply")]
    pub apply: bool,

    #[serde(rename = "localOnly")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_only: Option<bool>,

    #[serde(rename = "runtimeBudgetMinutes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_budget_minutes: Option<i32>,
}

impl CapabilitiesAgent {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(preflight: bool, run: bool, status: bool, apply: bool) -> CapabilitiesAgent {
        CapabilitiesAgent {
            preflight,
            run,
            status,
            apply,
            local_only: None,
            runtime_budget_minutes: None,
        }
    }
}

/// Converts the CapabilitiesAgent value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesAgent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("preflight".to_string()),
            Some(self.preflight.to_string()),
            Some("run".to_string()),
            Some(self.run.to_string()),
            Some("status".to_string()),
            Some(self.status.to_string()),
            Some("apply".to_string()),
            Some(self.apply.to_string()),
            self.local_only
                .as_ref()
                .map(|local_only| ["localOnly".to_string(), local_only.to_string()].join(",")),
            self.runtime_budget_minutes
                .as_ref()
                .map(|runtime_budget_minutes| {
                    [
                        "runtimeBudgetMinutes".to_string(),
                        runtime_budget_minutes.to_string(),
                    ]
                    .join(",")
                }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesAgent value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesAgent {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub preflight: Vec<bool>,
            pub run: Vec<bool>,
            pub status: Vec<bool>,
            pub apply: Vec<bool>,
            pub local_only: Vec<bool>,
            pub runtime_budget_minutes: Vec<i32>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesAgent".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "preflight" => intermediate_rep.preflight.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "run" => intermediate_rep.run.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "apply" => intermediate_rep.apply.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "localOnly" => intermediate_rep.local_only.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "runtimeBudgetMinutes" => intermediate_rep.runtime_budget_minutes.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesAgent".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesAgent {
            preflight: intermediate_rep
                .preflight
                .into_iter()
                .next()
                .ok_or_else(|| "preflight missing in CapabilitiesAgent".to_string())?,
            run: intermediate_rep
                .run
                .into_iter()
                .next()
                .ok_or_else(|| "run missing in CapabilitiesAgent".to_string())?,
            status: intermediate_rep
                .status
                .into_iter()
                .next()
                .ok_or_else(|| "status missing in CapabilitiesAgent".to_string())?,
            apply: intermediate_rep
                .apply
                .into_iter()
                .next()
                .ok_or_else(|| "apply missing in CapabilitiesAgent".to_string())?,
            local_only: intermediate_rep.local_only.into_iter().next(),
            runtime_budget_minutes: intermediate_rep.runtime_budget_minutes.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesAgent> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesAgent>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesAgent>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesAgent - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesAgent> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesAgent as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesAgent - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesResult {
    #[serde(rename = "protocolVersion")]
    #[validate(custom(function = "check_xss_string"))]
    pub protocol_version: String,

    #[serde(rename = "platform")]
    #[validate(custom(function = "check_xss_string"))]
    pub platform: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "phase")]
    #[validate(custom(function = "check_xss_string"))]
    pub phase: String,

    #[serde(rename = "capture")]
    #[validate(nested)]
    pub capture: models::CapabilitiesResultCapture,

    #[serde(rename = "recording")]
    #[validate(nested)]
    pub recording: models::CapabilitiesResultRecording,

    #[serde(rename = "export")]
    #[validate(nested)]
    pub export: models::CapabilitiesResultExport,

    #[serde(rename = "project")]
    #[validate(nested)]
    pub project: models::CapabilitiesResultProject,

    #[serde(rename = "agent")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<models::CapabilitiesAgent>,
}

impl CapabilitiesResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        protocol_version: String,
        platform: String,
        phase: String,
        capture: models::CapabilitiesResultCapture,
        recording: models::CapabilitiesResultRecording,
        export: models::CapabilitiesResultExport,
        project: models::CapabilitiesResultProject,
    ) -> CapabilitiesResult {
        CapabilitiesResult {
            protocol_version,
            platform,
            phase,
            capture,
            recording,
            export,
            project,
            agent: None,
        }
    }
}

/// Converts the CapabilitiesResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("protocolVersion".to_string()),
            Some(self.protocol_version.to_string()),
            Some("platform".to_string()),
            Some(self.platform.to_string()),
            Some("phase".to_string()),
            Some(self.phase.to_string()),
            // Skipping capture in query parameter serialization

            // Skipping recording in query parameter serialization

            // Skipping export in query parameter serialization

            // Skipping project in query parameter serialization

            // Skipping agent in query parameter serialization
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub protocol_version: Vec<String>,
            pub platform: Vec<String>,
            pub phase: Vec<String>,
            pub capture: Vec<models::CapabilitiesResultCapture>,
            pub recording: Vec<models::CapabilitiesResultRecording>,
            pub export: Vec<models::CapabilitiesResultExport>,
            pub project: Vec<models::CapabilitiesResultProject>,
            pub agent: Vec<models::CapabilitiesAgent>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "protocolVersion" => intermediate_rep.protocol_version.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "platform" => intermediate_rep.platform.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "phase" => intermediate_rep.phase.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "capture" => intermediate_rep.capture.push(
                        <models::CapabilitiesResultCapture as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "recording" => intermediate_rep.recording.push(
                        <models::CapabilitiesResultRecording as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "export" => intermediate_rep.export.push(
                        <models::CapabilitiesResultExport as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "project" => intermediate_rep.project.push(
                        <models::CapabilitiesResultProject as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "agent" => intermediate_rep.agent.push(
                        <models::CapabilitiesAgent as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesResult {
            protocol_version: intermediate_rep
                .protocol_version
                .into_iter()
                .next()
                .ok_or_else(|| "protocolVersion missing in CapabilitiesResult".to_string())?,
            platform: intermediate_rep
                .platform
                .into_iter()
                .next()
                .ok_or_else(|| "platform missing in CapabilitiesResult".to_string())?,
            phase: intermediate_rep
                .phase
                .into_iter()
                .next()
                .ok_or_else(|| "phase missing in CapabilitiesResult".to_string())?,
            capture: intermediate_rep
                .capture
                .into_iter()
                .next()
                .ok_or_else(|| "capture missing in CapabilitiesResult".to_string())?,
            recording: intermediate_rep
                .recording
                .into_iter()
                .next()
                .ok_or_else(|| "recording missing in CapabilitiesResult".to_string())?,
            export: intermediate_rep
                .export
                .into_iter()
                .next()
                .ok_or_else(|| "export missing in CapabilitiesResult".to_string())?,
            project: intermediate_rep
                .project
                .into_iter()
                .next()
                .ok_or_else(|| "project missing in CapabilitiesResult".to_string())?,
            agent: intermediate_rep.agent.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesResultCapture {
    #[serde(rename = "display")]
    pub display: bool,

    #[serde(rename = "window")]
    pub window: bool,

    #[serde(rename = "systemAudio")]
    pub system_audio: bool,

    #[serde(rename = "microphone")]
    pub microphone: bool,
}

impl CapabilitiesResultCapture {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        display: bool,
        window: bool,
        system_audio: bool,
        microphone: bool,
    ) -> CapabilitiesResultCapture {
        CapabilitiesResultCapture {
            display,
            window,
            system_audio,
            microphone,
        }
    }
}

/// Converts the CapabilitiesResultCapture value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesResultCapture {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("display".to_string()),
            Some(self.display.to_string()),
            Some("window".to_string()),
            Some(self.window.to_string()),
            Some("systemAudio".to_string()),
            Some(self.system_audio.to_string()),
            Some("microphone".to_string()),
            Some(self.microphone.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesResultCapture value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesResultCapture {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub display: Vec<bool>,
            pub window: Vec<bool>,
            pub system_audio: Vec<bool>,
            pub microphone: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesResultCapture".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "display" => intermediate_rep.display.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "window" => intermediate_rep.window.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "systemAudio" => intermediate_rep.system_audio.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "microphone" => intermediate_rep.microphone.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesResultCapture".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesResultCapture {
            display: intermediate_rep
                .display
                .into_iter()
                .next()
                .ok_or_else(|| "display missing in CapabilitiesResultCapture".to_string())?,
            window: intermediate_rep
                .window
                .into_iter()
                .next()
                .ok_or_else(|| "window missing in CapabilitiesResultCapture".to_string())?,
            system_audio: intermediate_rep
                .system_audio
                .into_iter()
                .next()
                .ok_or_else(|| "systemAudio missing in CapabilitiesResultCapture".to_string())?,
            microphone: intermediate_rep
                .microphone
                .into_iter()
                .next()
                .ok_or_else(|| "microphone missing in CapabilitiesResultCapture".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesResultCapture> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesResultCapture>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesResultCapture>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesResultCapture - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesResultCapture> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesResultCapture as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesResultCapture - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesResultExport {
    #[serde(rename = "presets")]
    pub presets: bool,

    #[serde(rename = "cutPlan")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cut_plan: Option<bool>,
}

impl CapabilitiesResultExport {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(presets: bool) -> CapabilitiesResultExport {
        CapabilitiesResultExport {
            presets,
            cut_plan: None,
        }
    }
}

/// Converts the CapabilitiesResultExport value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesResultExport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("presets".to_string()),
            Some(self.presets.to_string()),
            self.cut_plan
                .as_ref()
                .map(|cut_plan| ["cutPlan".to_string(), cut_plan.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesResultExport value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesResultExport {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub presets: Vec<bool>,
            pub cut_plan: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesResultExport".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "presets" => intermediate_rep.presets.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "cutPlan" => intermediate_rep.cut_plan.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesResultExport".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesResultExport {
            presets: intermediate_rep
                .presets
                .into_iter()
                .next()
                .ok_or_else(|| "presets missing in CapabilitiesResultExport".to_string())?,
            cut_plan: intermediate_rep.cut_plan.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesResultExport> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesResultExport>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesResultExport>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesResultExport - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesResultExport> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesResultExport as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesResultExport - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesResultProject {
    #[serde(rename = "openSave")]
    pub open_save: bool,
}

impl CapabilitiesResultProject {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(open_save: bool) -> CapabilitiesResultProject {
        CapabilitiesResultProject { open_save }
    }
}

/// Converts the CapabilitiesResultProject value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesResultProject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("openSave".to_string()),
            Some(self.open_save.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesResultProject value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesResultProject {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub open_save: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesResultProject".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "openSave" => intermediate_rep.open_save.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesResultProject".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesResultProject {
            open_save: intermediate_rep
                .open_save
                .into_iter()
                .next()
                .ok_or_else(|| "openSave missing in CapabilitiesResultProject".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesResultProject> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesResultProject>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesResultProject>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesResultProject - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesResultProject> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesResultProject as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesResultProject - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapabilitiesResultRecording {
    #[serde(rename = "inputTracking")]
    pub input_tracking: bool,
}

impl CapabilitiesResultRecording {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(input_tracking: bool) -> CapabilitiesResultRecording {
        CapabilitiesResultRecording { input_tracking }
    }
}

/// Converts the CapabilitiesResultRecording value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapabilitiesResultRecording {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("inputTracking".to_string()),
            Some(self.input_tracking.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapabilitiesResultRecording value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapabilitiesResultRecording {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub input_tracking: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapabilitiesResultRecording".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "inputTracking" => intermediate_rep.input_tracking.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapabilitiesResultRecording".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapabilitiesResultRecording {
            input_tracking: intermediate_rep
                .input_tracking
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "inputTracking missing in CapabilitiesResultRecording".to_string()
                })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapabilitiesResultRecording> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapabilitiesResultRecording>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapabilitiesResultRecording>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapabilitiesResultRecording - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapabilitiesResultRecording> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapabilitiesResultRecording as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapabilitiesResultRecording - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapturePreviewFrame {
    #[serde(rename = "frameId")]
    pub frame_id: i32,

    #[serde(rename = "bytesBase64")]
    #[validate(custom(function = "check_xss_string"))]
    pub bytes_base64: String,
}

impl CapturePreviewFrame {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(frame_id: i32, bytes_base64: String) -> CapturePreviewFrame {
        CapturePreviewFrame {
            frame_id,
            bytes_base64,
        }
    }
}

/// Converts the CapturePreviewFrame value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapturePreviewFrame {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("frameId".to_string()),
            Some(self.frame_id.to_string()),
            Some("bytesBase64".to_string()),
            Some(self.bytes_base64.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapturePreviewFrame value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapturePreviewFrame {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub frame_id: Vec<i32>,
            pub bytes_base64: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapturePreviewFrame".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "frameId" => intermediate_rep.frame_id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "bytesBase64" => intermediate_rep.bytes_base64.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapturePreviewFrame".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapturePreviewFrame {
            frame_id: intermediate_rep
                .frame_id
                .into_iter()
                .next()
                .ok_or_else(|| "frameId missing in CapturePreviewFrame".to_string())?,
            bytes_base64: intermediate_rep
                .bytes_base64
                .into_iter()
                .next()
                .ok_or_else(|| "bytesBase64 missing in CapturePreviewFrame".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapturePreviewFrame> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapturePreviewFrame>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapturePreviewFrame>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapturePreviewFrame - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapturePreviewFrame> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapturePreviewFrame as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapturePreviewFrame - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CapturePreviewFrameResult {
    #[serde(rename = "frame")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame: Option<models::CapturePreviewFrame>,
}

impl CapturePreviewFrameResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> CapturePreviewFrameResult {
        CapturePreviewFrameResult { frame: None }
    }
}

/// Converts the CapturePreviewFrameResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CapturePreviewFrameResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping frame in query parameter serialization

        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CapturePreviewFrameResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CapturePreviewFrameResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub frame: Vec<models::CapturePreviewFrame>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CapturePreviewFrameResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "frame" => intermediate_rep.frame.push(
                        <models::CapturePreviewFrame as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CapturePreviewFrameResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CapturePreviewFrameResult {
            frame: intermediate_rep.frame.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CapturePreviewFrameResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CapturePreviewFrameResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CapturePreviewFrameResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CapturePreviewFrameResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CapturePreviewFrameResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CapturePreviewFrameResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CapturePreviewFrameResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStartCurrentWindowPayload {
    #[serde(rename = "enableMic")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_mic: Option<bool>,

    #[serde(rename = "enablePreview")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_preview: Option<bool>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "captureFps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_fps: Option<f64>,
}

impl CaptureStartCurrentWindowPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> CaptureStartCurrentWindowPayload {
        CaptureStartCurrentWindowPayload {
            enable_mic: None,
            enable_preview: None,
            capture_fps: None,
        }
    }
}

/// Converts the CaptureStartCurrentWindowPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStartCurrentWindowPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.enable_mic
                .as_ref()
                .map(|enable_mic| ["enableMic".to_string(), enable_mic.to_string()].join(",")),
            self.enable_preview.as_ref().map(|enable_preview| {
                ["enablePreview".to_string(), enable_preview.to_string()].join(",")
            }),
            self.capture_fps
                .as_ref()
                .map(|capture_fps| ["captureFps".to_string(), capture_fps.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStartCurrentWindowPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStartCurrentWindowPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub enable_mic: Vec<bool>,
            pub enable_preview: Vec<bool>,
            pub capture_fps: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStartCurrentWindowPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "enableMic" => intermediate_rep.enable_mic.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enablePreview" => intermediate_rep.enable_preview.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "captureFps" => intermediate_rep.capture_fps.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CaptureStartCurrentWindowPayload"
                                .to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStartCurrentWindowPayload {
            enable_mic: intermediate_rep.enable_mic.into_iter().next(),
            enable_preview: intermediate_rep.enable_preview.into_iter().next(),
            capture_fps: intermediate_rep.capture_fps.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStartCurrentWindowPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStartCurrentWindowPayload>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStartCurrentWindowPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStartCurrentWindowPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<CaptureStartCurrentWindowPayload>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStartCurrentWindowPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStartCurrentWindowPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStartDisplayPayload {
    #[serde(rename = "displayId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_id: Option<i32>,

    #[serde(rename = "enableMic")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_mic: Option<bool>,

    #[serde(rename = "enablePreview")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_preview: Option<bool>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "captureFps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_fps: Option<f64>,
}

impl CaptureStartDisplayPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> CaptureStartDisplayPayload {
        CaptureStartDisplayPayload {
            display_id: None,
            enable_mic: None,
            enable_preview: None,
            capture_fps: None,
        }
    }
}

/// Converts the CaptureStartDisplayPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStartDisplayPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.display_id
                .as_ref()
                .map(|display_id| ["displayId".to_string(), display_id.to_string()].join(",")),
            self.enable_mic
                .as_ref()
                .map(|enable_mic| ["enableMic".to_string(), enable_mic.to_string()].join(",")),
            self.enable_preview.as_ref().map(|enable_preview| {
                ["enablePreview".to_string(), enable_preview.to_string()].join(",")
            }),
            self.capture_fps
                .as_ref()
                .map(|capture_fps| ["captureFps".to_string(), capture_fps.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStartDisplayPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStartDisplayPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub display_id: Vec<i32>,
            pub enable_mic: Vec<bool>,
            pub enable_preview: Vec<bool>,
            pub capture_fps: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStartDisplayPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "displayId" => intermediate_rep.display_id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enableMic" => intermediate_rep.enable_mic.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enablePreview" => intermediate_rep.enable_preview.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "captureFps" => intermediate_rep.capture_fps.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CaptureStartDisplayPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStartDisplayPayload {
            display_id: intermediate_rep.display_id.into_iter().next(),
            enable_mic: intermediate_rep.enable_mic.into_iter().next(),
            enable_preview: intermediate_rep.enable_preview.into_iter().next(),
            capture_fps: intermediate_rep.capture_fps.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStartDisplayPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStartDisplayPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStartDisplayPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStartDisplayPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CaptureStartDisplayPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStartDisplayPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStartDisplayPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStartWindowPayload {
    #[serde(rename = "windowId")]
    pub window_id: i32,

    #[serde(rename = "enableMic")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_mic: Option<bool>,

    #[serde(rename = "enablePreview")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_preview: Option<bool>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "captureFps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_fps: Option<f64>,
}

impl CaptureStartWindowPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(window_id: i32) -> CaptureStartWindowPayload {
        CaptureStartWindowPayload {
            window_id,
            enable_mic: None,
            enable_preview: None,
            capture_fps: None,
        }
    }
}

/// Converts the CaptureStartWindowPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStartWindowPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("windowId".to_string()),
            Some(self.window_id.to_string()),
            self.enable_mic
                .as_ref()
                .map(|enable_mic| ["enableMic".to_string(), enable_mic.to_string()].join(",")),
            self.enable_preview.as_ref().map(|enable_preview| {
                ["enablePreview".to_string(), enable_preview.to_string()].join(",")
            }),
            self.capture_fps
                .as_ref()
                .map(|capture_fps| ["captureFps".to_string(), capture_fps.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStartWindowPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStartWindowPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub window_id: Vec<i32>,
            pub enable_mic: Vec<bool>,
            pub enable_preview: Vec<bool>,
            pub capture_fps: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStartWindowPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "windowId" => intermediate_rep.window_id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enableMic" => intermediate_rep.enable_mic.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "enablePreview" => intermediate_rep.enable_preview.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "captureFps" => intermediate_rep.capture_fps.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CaptureStartWindowPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStartWindowPayload {
            window_id: intermediate_rep
                .window_id
                .into_iter()
                .next()
                .ok_or_else(|| "windowId missing in CaptureStartWindowPayload".to_string())?,
            enable_mic: intermediate_rep.enable_mic.into_iter().next(),
            enable_preview: intermediate_rep.enable_preview.into_iter().next(),
            capture_fps: intermediate_rep.capture_fps.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStartWindowPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStartWindowPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStartWindowPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStartWindowPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CaptureStartWindowPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStartWindowPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStartWindowPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStatusResult {
    #[serde(rename = "isRunning")]
    pub is_running: bool,

    #[serde(rename = "isRecording")]
    pub is_recording: bool,

    #[serde(rename = "captureSessionId")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_session_id: Option<String>,

    #[serde(rename = "recordingDurationSeconds")]
    pub recording_duration_seconds: f64,

    #[serde(rename = "recordingURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_url: Option<String>,

    #[serde(rename = "captureMetadata")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_metadata: Option<models::CaptureStatusResultCaptureMetadata>,

    #[serde(rename = "lastError")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<models::EngineBadRequestError>,

    #[serde(rename = "eventsURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events_url: Option<String>,

    #[serde(rename = "lastRecordingTelemetry")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_recording_telemetry: Option<models::CaptureTelemetry>,

    #[serde(rename = "telemetry")]
    #[validate(nested)]
    pub telemetry: models::CaptureTelemetry,
}

impl CaptureStatusResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        is_running: bool,
        is_recording: bool,
        recording_duration_seconds: f64,
        telemetry: models::CaptureTelemetry,
    ) -> CaptureStatusResult {
        CaptureStatusResult {
            is_running,
            is_recording,
            capture_session_id: None,
            recording_duration_seconds,
            recording_url: None,
            capture_metadata: None,
            last_error: None,
            events_url: None,
            last_recording_telemetry: None,
            telemetry,
        }
    }
}

/// Converts the CaptureStatusResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStatusResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("isRunning".to_string()),
            Some(self.is_running.to_string()),
            Some("isRecording".to_string()),
            Some(self.is_recording.to_string()),
            self.capture_session_id.as_ref().map(|capture_session_id| {
                [
                    "captureSessionId".to_string(),
                    capture_session_id.to_string(),
                ]
                .join(",")
            }),
            Some("recordingDurationSeconds".to_string()),
            Some(self.recording_duration_seconds.to_string()),
            self.recording_url.as_ref().map(|recording_url| {
                ["recordingURL".to_string(), recording_url.to_string()].join(",")
            }),
            // Skipping captureMetadata in query parameter serialization

            // Skipping lastError in query parameter serialization
            self.events_url
                .as_ref()
                .map(|events_url| ["eventsURL".to_string(), events_url.to_string()].join(",")),
            // Skipping lastRecordingTelemetry in query parameter serialization

            // Skipping telemetry in query parameter serialization
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStatusResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStatusResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub is_running: Vec<bool>,
            pub is_recording: Vec<bool>,
            pub capture_session_id: Vec<String>,
            pub recording_duration_seconds: Vec<f64>,
            pub recording_url: Vec<String>,
            pub capture_metadata: Vec<models::CaptureStatusResultCaptureMetadata>,
            pub last_error: Vec<models::EngineBadRequestError>,
            pub events_url: Vec<String>,
            pub last_recording_telemetry: Vec<models::CaptureTelemetry>,
            pub telemetry: Vec<models::CaptureTelemetry>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStatusResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "isRunning" => intermediate_rep.is_running.push(<bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "isRecording" => intermediate_rep.is_recording.push(<bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "captureSessionId" => intermediate_rep.capture_session_id.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "recordingDurationSeconds" => intermediate_rep.recording_duration_seconds.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "recordingURL" => intermediate_rep.recording_url.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "captureMetadata" => intermediate_rep.capture_metadata.push(<models::CaptureStatusResultCaptureMetadata as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "lastError" => intermediate_rep.last_error.push(<models::EngineBadRequestError as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "eventsURL" => intermediate_rep.events_url.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "lastRecordingTelemetry" => intermediate_rep.last_recording_telemetry.push(<models::CaptureTelemetry as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "telemetry" => intermediate_rep.telemetry.push(<models::CaptureTelemetry as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing CaptureStatusResult".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStatusResult {
            is_running: intermediate_rep
                .is_running
                .into_iter()
                .next()
                .ok_or_else(|| "isRunning missing in CaptureStatusResult".to_string())?,
            is_recording: intermediate_rep
                .is_recording
                .into_iter()
                .next()
                .ok_or_else(|| "isRecording missing in CaptureStatusResult".to_string())?,
            capture_session_id: intermediate_rep.capture_session_id.into_iter().next(),
            recording_duration_seconds: intermediate_rep
                .recording_duration_seconds
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "recordingDurationSeconds missing in CaptureStatusResult".to_string()
                })?,
            recording_url: intermediate_rep.recording_url.into_iter().next(),
            capture_metadata: intermediate_rep.capture_metadata.into_iter().next(),
            last_error: intermediate_rep.last_error.into_iter().next(),
            events_url: intermediate_rep.events_url.into_iter().next(),
            last_recording_telemetry: intermediate_rep.last_recording_telemetry.into_iter().next(),
            telemetry: intermediate_rep
                .telemetry
                .into_iter()
                .next()
                .ok_or_else(|| "telemetry missing in CaptureStatusResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStatusResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStatusResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStatusResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStatusResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CaptureStatusResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStatusResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStatusResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStatusResultCaptureMetadata {
    #[serde(rename = "window")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window: Option<models::CaptureStatusResultCaptureMetadataWindow>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "source")]
    #[validate(custom(function = "check_xss_string"))]
    pub source: String,

    #[serde(rename = "contentRect")]
    #[validate(nested)]
    pub content_rect: models::CaptureStatusResultCaptureMetadataContentRect,

    #[serde(rename = "pixelScale")]
    pub pixel_scale: f64,

    #[serde(rename = "fps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<f64>,
}

impl CaptureStatusResultCaptureMetadata {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        source: String,
        content_rect: models::CaptureStatusResultCaptureMetadataContentRect,
        pixel_scale: f64,
    ) -> CaptureStatusResultCaptureMetadata {
        CaptureStatusResultCaptureMetadata {
            window: None,
            source,
            content_rect,
            pixel_scale,
            fps: None,
        }
    }
}

/// Converts the CaptureStatusResultCaptureMetadata value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStatusResultCaptureMetadata {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping window in query parameter serialization
            Some("source".to_string()),
            Some(self.source.to_string()),
            // Skipping contentRect in query parameter serialization
            Some("pixelScale".to_string()),
            Some(self.pixel_scale.to_string()),
            self.fps
                .as_ref()
                .map(|fps| ["fps".to_string(), fps.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStatusResultCaptureMetadata value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStatusResultCaptureMetadata {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub window: Vec<models::CaptureStatusResultCaptureMetadataWindow>,
            pub source: Vec<String>,
            pub content_rect: Vec<models::CaptureStatusResultCaptureMetadataContentRect>,
            pub pixel_scale: Vec<f64>,
            pub fps: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStatusResultCaptureMetadata"
                            .to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "window" => intermediate_rep.window.push(<models::CaptureStatusResultCaptureMetadataWindow as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "source" => intermediate_rep.source.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "contentRect" => intermediate_rep.content_rect.push(<models::CaptureStatusResultCaptureMetadataContentRect as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "pixelScale" => intermediate_rep.pixel_scale.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "fps" => intermediate_rep.fps.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing CaptureStatusResultCaptureMetadata".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStatusResultCaptureMetadata {
            window: intermediate_rep.window.into_iter().next(),
            source: intermediate_rep.source.into_iter().next().ok_or_else(|| {
                "source missing in CaptureStatusResultCaptureMetadata".to_string()
            })?,
            content_rect: intermediate_rep
                .content_rect
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "contentRect missing in CaptureStatusResultCaptureMetadata".to_string()
                })?,
            pixel_scale: intermediate_rep
                .pixel_scale
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "pixelScale missing in CaptureStatusResultCaptureMetadata".to_string()
                })?,
            fps: intermediate_rep.fps.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStatusResultCaptureMetadata> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStatusResultCaptureMetadata>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStatusResultCaptureMetadata>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStatusResultCaptureMetadata - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<CaptureStatusResultCaptureMetadata>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStatusResultCaptureMetadata as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStatusResultCaptureMetadata - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStatusResultCaptureMetadataContentRect {
    #[serde(rename = "x")]
    pub x: f64,

    #[serde(rename = "y")]
    pub y: f64,

    #[serde(rename = "width")]
    pub width: f64,

    #[serde(rename = "height")]
    pub height: f64,
}

impl CaptureStatusResultCaptureMetadataContentRect {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> CaptureStatusResultCaptureMetadataContentRect {
        CaptureStatusResultCaptureMetadataContentRect {
            x,
            y,
            width,
            height,
        }
    }
}

/// Converts the CaptureStatusResultCaptureMetadataContentRect value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStatusResultCaptureMetadataContentRect {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("x".to_string()),
            Some(self.x.to_string()),
            Some("y".to_string()),
            Some(self.y.to_string()),
            Some("width".to_string()),
            Some(self.width.to_string()),
            Some("height".to_string()),
            Some(self.height.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStatusResultCaptureMetadataContentRect value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStatusResultCaptureMetadataContentRect {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub x: Vec<f64>,
            pub y: Vec<f64>,
            pub width: Vec<f64>,
            pub height: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val =
                match string_iter.next() {
                    Some(x) => x,
                    None => return std::result::Result::Err(
                        "Missing value while parsing CaptureStatusResultCaptureMetadataContentRect"
                            .to_string(),
                    ),
                };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "x" => intermediate_rep.x.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "y" => intermediate_rep.y.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "width" => intermediate_rep.width.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "height" => intermediate_rep.height.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing CaptureStatusResultCaptureMetadataContentRect".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStatusResultCaptureMetadataContentRect {
            x: intermediate_rep.x.into_iter().next().ok_or_else(|| {
                "x missing in CaptureStatusResultCaptureMetadataContentRect".to_string()
            })?,
            y: intermediate_rep.y.into_iter().next().ok_or_else(|| {
                "y missing in CaptureStatusResultCaptureMetadataContentRect".to_string()
            })?,
            width: intermediate_rep.width.into_iter().next().ok_or_else(|| {
                "width missing in CaptureStatusResultCaptureMetadataContentRect".to_string()
            })?,
            height: intermediate_rep.height.into_iter().next().ok_or_else(|| {
                "height missing in CaptureStatusResultCaptureMetadataContentRect".to_string()
            })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStatusResultCaptureMetadataContentRect> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStatusResultCaptureMetadataContentRect>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStatusResultCaptureMetadataContentRect>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStatusResultCaptureMetadataContentRect - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<CaptureStatusResultCaptureMetadataContentRect>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStatusResultCaptureMetadataContentRect as std::str::FromStr>::from_str(
                    value,
                ) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStatusResultCaptureMetadataContentRect - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureStatusResultCaptureMetadataWindow {
    #[serde(rename = "id")]
    pub id: i32,

    #[serde(rename = "title")]
    #[validate(custom(function = "check_xss_string"))]
    pub title: String,

    #[serde(rename = "appName")]
    #[validate(custom(function = "check_xss_string"))]
    pub app_name: String,
}

impl CaptureStatusResultCaptureMetadataWindow {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        id: i32,
        title: String,
        app_name: String,
    ) -> CaptureStatusResultCaptureMetadataWindow {
        CaptureStatusResultCaptureMetadataWindow {
            id,
            title,
            app_name,
        }
    }
}

/// Converts the CaptureStatusResultCaptureMetadataWindow value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureStatusResultCaptureMetadataWindow {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("title".to_string()),
            Some(self.title.to_string()),
            Some("appName".to_string()),
            Some(self.app_name.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureStatusResultCaptureMetadataWindow value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureStatusResultCaptureMetadataWindow {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<i32>,
            pub title: Vec<String>,
            pub app_name: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureStatusResultCaptureMetadataWindow"
                            .to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "title" => intermediate_rep.title.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "appName" => intermediate_rep.app_name.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CaptureStatusResultCaptureMetadataWindow"
                                .to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureStatusResultCaptureMetadataWindow {
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| {
                "id missing in CaptureStatusResultCaptureMetadataWindow".to_string()
            })?,
            title: intermediate_rep.title.into_iter().next().ok_or_else(|| {
                "title missing in CaptureStatusResultCaptureMetadataWindow".to_string()
            })?,
            app_name: intermediate_rep
                .app_name
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "appName missing in CaptureStatusResultCaptureMetadataWindow".to_string()
                })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureStatusResultCaptureMetadataWindow> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureStatusResultCaptureMetadataWindow>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureStatusResultCaptureMetadataWindow>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureStatusResultCaptureMetadataWindow - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<CaptureStatusResultCaptureMetadataWindow>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureStatusResultCaptureMetadataWindow as std::str::FromStr>::from_str(
                    value,
                ) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureStatusResultCaptureMetadataWindow - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct CaptureTelemetry {
    #[serde(rename = "sourceDroppedFrames")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_dropped_frames: Option<i32>,

    #[serde(rename = "writerDroppedFrames")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writer_dropped_frames: Option<i32>,

    #[serde(rename = "writerBackpressureDrops")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writer_backpressure_drops: Option<i32>,

    #[serde(rename = "achievedFps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub achieved_fps: Option<f64>,

    #[serde(rename = "cpuPercent")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<f64>,

    #[serde(rename = "memoryBytes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_bytes: Option<f64>,

    #[serde(rename = "recordingBitrateMbps")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_bitrate_mbps: Option<f64>,

    #[serde(rename = "captureCallbackMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_callback_ms: Option<f64>,

    #[serde(rename = "recordQueueLagMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub record_queue_lag_ms: Option<f64>,

    #[serde(rename = "writerAppendMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writer_append_ms: Option<f64>,

    #[serde(rename = "previewEncodeMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_encode_ms: Option<f64>,
}

impl CaptureTelemetry {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> CaptureTelemetry {
        CaptureTelemetry {
            source_dropped_frames: None,
            writer_dropped_frames: None,
            writer_backpressure_drops: None,
            achieved_fps: None,
            cpu_percent: None,
            memory_bytes: None,
            recording_bitrate_mbps: None,
            capture_callback_ms: None,
            record_queue_lag_ms: None,
            writer_append_ms: None,
            preview_encode_ms: None,
        }
    }
}

/// Converts the CaptureTelemetry value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for CaptureTelemetry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.source_dropped_frames
                .as_ref()
                .map(|source_dropped_frames| {
                    [
                        "sourceDroppedFrames".to_string(),
                        source_dropped_frames.to_string(),
                    ]
                    .join(",")
                }),
            self.writer_dropped_frames
                .as_ref()
                .map(|writer_dropped_frames| {
                    [
                        "writerDroppedFrames".to_string(),
                        writer_dropped_frames.to_string(),
                    ]
                    .join(",")
                }),
            self.writer_backpressure_drops
                .as_ref()
                .map(|writer_backpressure_drops| {
                    [
                        "writerBackpressureDrops".to_string(),
                        writer_backpressure_drops.to_string(),
                    ]
                    .join(",")
                }),
            self.achieved_fps.as_ref().map(|achieved_fps| {
                ["achievedFps".to_string(), achieved_fps.to_string()].join(",")
            }),
            self.cpu_percent
                .as_ref()
                .map(|cpu_percent| ["cpuPercent".to_string(), cpu_percent.to_string()].join(",")),
            self.memory_bytes.as_ref().map(|memory_bytes| {
                ["memoryBytes".to_string(), memory_bytes.to_string()].join(",")
            }),
            self.recording_bitrate_mbps
                .as_ref()
                .map(|recording_bitrate_mbps| {
                    [
                        "recordingBitrateMbps".to_string(),
                        recording_bitrate_mbps.to_string(),
                    ]
                    .join(",")
                }),
            self.capture_callback_ms
                .as_ref()
                .map(|capture_callback_ms| {
                    [
                        "captureCallbackMs".to_string(),
                        capture_callback_ms.to_string(),
                    ]
                    .join(",")
                }),
            self.record_queue_lag_ms
                .as_ref()
                .map(|record_queue_lag_ms| {
                    [
                        "recordQueueLagMs".to_string(),
                        record_queue_lag_ms.to_string(),
                    ]
                    .join(",")
                }),
            self.writer_append_ms.as_ref().map(|writer_append_ms| {
                ["writerAppendMs".to_string(), writer_append_ms.to_string()].join(",")
            }),
            self.preview_encode_ms.as_ref().map(|preview_encode_ms| {
                ["previewEncodeMs".to_string(), preview_encode_ms.to_string()].join(",")
            }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a CaptureTelemetry value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for CaptureTelemetry {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub source_dropped_frames: Vec<i32>,
            pub writer_dropped_frames: Vec<i32>,
            pub writer_backpressure_drops: Vec<i32>,
            pub achieved_fps: Vec<f64>,
            pub cpu_percent: Vec<f64>,
            pub memory_bytes: Vec<f64>,
            pub recording_bitrate_mbps: Vec<f64>,
            pub capture_callback_ms: Vec<f64>,
            pub record_queue_lag_ms: Vec<f64>,
            pub writer_append_ms: Vec<f64>,
            pub preview_encode_ms: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing CaptureTelemetry".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "sourceDroppedFrames" => intermediate_rep.source_dropped_frames.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "writerDroppedFrames" => intermediate_rep.writer_dropped_frames.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "writerBackpressureDrops" => intermediate_rep.writer_backpressure_drops.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "achievedFps" => intermediate_rep.achieved_fps.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "cpuPercent" => intermediate_rep.cpu_percent.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "memoryBytes" => intermediate_rep.memory_bytes.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "recordingBitrateMbps" => intermediate_rep.recording_bitrate_mbps.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "captureCallbackMs" => intermediate_rep.capture_callback_ms.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "recordQueueLagMs" => intermediate_rep.record_queue_lag_ms.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "writerAppendMs" => intermediate_rep.writer_append_ms.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "previewEncodeMs" => intermediate_rep.preview_encode_ms.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing CaptureTelemetry".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(CaptureTelemetry {
            source_dropped_frames: intermediate_rep.source_dropped_frames.into_iter().next(),
            writer_dropped_frames: intermediate_rep.writer_dropped_frames.into_iter().next(),
            writer_backpressure_drops: intermediate_rep
                .writer_backpressure_drops
                .into_iter()
                .next(),
            achieved_fps: intermediate_rep.achieved_fps.into_iter().next(),
            cpu_percent: intermediate_rep.cpu_percent.into_iter().next(),
            memory_bytes: intermediate_rep.memory_bytes.into_iter().next(),
            recording_bitrate_mbps: intermediate_rep.recording_bitrate_mbps.into_iter().next(),
            capture_callback_ms: intermediate_rep.capture_callback_ms.into_iter().next(),
            record_queue_lag_ms: intermediate_rep.record_queue_lag_ms.into_iter().next(),
            writer_append_ms: intermediate_rep.writer_append_ms.into_iter().next(),
            preview_encode_ms: intermediate_rep.preview_encode_ms.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<CaptureTelemetry> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<CaptureTelemetry>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<CaptureTelemetry>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for CaptureTelemetry - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<CaptureTelemetry> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <CaptureTelemetry as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into CaptureTelemetry - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct DisplaySource {
    #[serde(rename = "id")]
    pub id: i32,

    #[serde(rename = "displayName")]
    #[validate(custom(function = "check_xss_string"))]
    pub display_name: String,

    #[serde(rename = "isPrimary")]
    pub is_primary: bool,

    #[serde(rename = "width")]
    pub width: i32,

    #[serde(rename = "height")]
    pub height: i32,

    #[serde(rename = "pixelScale")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pixel_scale: Option<f64>,

    #[serde(rename = "refreshHz")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_hz: Option<f64>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "supportedCaptureFrameRates")]
    pub supported_capture_frame_rates: Vec<f64>,
}

impl DisplaySource {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        id: i32,
        display_name: String,
        is_primary: bool,
        width: i32,
        height: i32,
        supported_capture_frame_rates: Vec<f64>,
    ) -> DisplaySource {
        DisplaySource {
            id,
            display_name,
            is_primary,
            width,
            height,
            pixel_scale: None,
            refresh_hz: None,
            supported_capture_frame_rates,
        }
    }
}

/// Converts the DisplaySource value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for DisplaySource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("displayName".to_string()),
            Some(self.display_name.to_string()),
            Some("isPrimary".to_string()),
            Some(self.is_primary.to_string()),
            Some("width".to_string()),
            Some(self.width.to_string()),
            Some("height".to_string()),
            Some(self.height.to_string()),
            self.pixel_scale
                .as_ref()
                .map(|pixel_scale| ["pixelScale".to_string(), pixel_scale.to_string()].join(",")),
            self.refresh_hz
                .as_ref()
                .map(|refresh_hz| ["refreshHz".to_string(), refresh_hz.to_string()].join(",")),
            Some("supportedCaptureFrameRates".to_string()),
            Some(
                self.supported_capture_frame_rates
                    .iter()
                    .map(|x| x.to_string())
                    .collect::<Vec<_>>()
                    .join(","),
            ),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a DisplaySource value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for DisplaySource {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<i32>,
            pub display_name: Vec<String>,
            pub is_primary: Vec<bool>,
            pub width: Vec<i32>,
            pub height: Vec<i32>,
            pub pixel_scale: Vec<f64>,
            pub refresh_hz: Vec<f64>,
            pub supported_capture_frame_rates: Vec<Vec<f64>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing DisplaySource".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "displayName" => intermediate_rep.display_name.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "isPrimary" => intermediate_rep.is_primary.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "width" => intermediate_rep.width.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "height" => intermediate_rep.height.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "pixelScale" => intermediate_rep.pixel_scale.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "refreshHz" => intermediate_rep.refresh_hz.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    "supportedCaptureFrameRates" => {
                        return std::result::Result::Err(
                            "Parsing a container in this style is not supported in DisplaySource"
                                .to_string(),
                        );
                    }
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing DisplaySource".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(DisplaySource {
            id: intermediate_rep
                .id
                .into_iter()
                .next()
                .ok_or_else(|| "id missing in DisplaySource".to_string())?,
            display_name: intermediate_rep
                .display_name
                .into_iter()
                .next()
                .ok_or_else(|| "displayName missing in DisplaySource".to_string())?,
            is_primary: intermediate_rep
                .is_primary
                .into_iter()
                .next()
                .ok_or_else(|| "isPrimary missing in DisplaySource".to_string())?,
            width: intermediate_rep
                .width
                .into_iter()
                .next()
                .ok_or_else(|| "width missing in DisplaySource".to_string())?,
            height: intermediate_rep
                .height
                .into_iter()
                .next()
                .ok_or_else(|| "height missing in DisplaySource".to_string())?,
            pixel_scale: intermediate_rep.pixel_scale.into_iter().next(),
            refresh_hz: intermediate_rep.refresh_hz.into_iter().next(),
            supported_capture_frame_rates: intermediate_rep
                .supported_capture_frame_rates
                .into_iter()
                .next()
                .ok_or_else(|| "supportedCaptureFrameRates missing in DisplaySource".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<DisplaySource> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<DisplaySource>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<DisplaySource>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for DisplaySource - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<DisplaySource> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <DisplaySource as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into DisplaySource - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineBadRequestError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineBadRequestError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineBadRequestError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineBadRequestError {
        EngineBadRequestError { code, message }
    }
}

/// Converts the EngineBadRequestError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineBadRequestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineBadRequestError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineBadRequestError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineBadRequestError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineBadRequestError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineBadRequestError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineBadRequestError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineBadRequestError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineBadRequestError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineBadRequestError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineBadRequestError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineBadRequestError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineBadRequestError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineBadRequestError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineBadRequestError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineConflictError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineConflictError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineConflictError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineConflictError {
        EngineConflictError { code, message }
    }
}

/// Converts the EngineConflictError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineConflictError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineConflictError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineConflictError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineConflictError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineConflictError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineConflictError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineConflictError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineConflictError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineConflictError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineConflictError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineConflictError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineConflictError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineConflictError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineConflictError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineConflictError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineForbiddenError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineForbiddenError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineForbiddenError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineForbiddenError {
        EngineForbiddenError { code, message }
    }
}

/// Converts the EngineForbiddenError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineForbiddenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineForbiddenError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineForbiddenError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineForbiddenError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineForbiddenError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineForbiddenError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineForbiddenError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineForbiddenError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineForbiddenError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineForbiddenError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineForbiddenError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineForbiddenError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineForbiddenError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineForbiddenError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineForbiddenError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineNotFoundError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineNotFoundError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineNotFoundError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineNotFoundError {
        EngineNotFoundError { code, message }
    }
}

/// Converts the EngineNotFoundError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineNotFoundError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineNotFoundError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineNotFoundError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineNotFoundError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineNotFoundError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineNotFoundError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineNotFoundError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineNotFoundError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineNotFoundError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineNotFoundError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineNotFoundError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineNotFoundError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineNotFoundError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineNotFoundError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineNotFoundError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineRuntimeError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineRuntimeError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineRuntimeError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineRuntimeError {
        EngineRuntimeError { code, message }
    }
}

/// Converts the EngineRuntimeError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineRuntimeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineRuntimeError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineRuntimeError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineRuntimeError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineRuntimeError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineRuntimeError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineRuntimeError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineRuntimeError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineRuntimeError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineRuntimeError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineRuntimeError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineRuntimeError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineRuntimeError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineRuntimeError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineRuntimeError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineUnauthorizedError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineUnauthorizedError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineUnauthorizedError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineUnauthorizedError {
        EngineUnauthorizedError { code, message }
    }
}

/// Converts the EngineUnauthorizedError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineUnauthorizedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineUnauthorizedError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineUnauthorizedError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineUnauthorizedError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineUnauthorizedError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineUnauthorizedError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineUnauthorizedError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineUnauthorizedError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineUnauthorizedError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineUnauthorizedError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineUnauthorizedError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineUnauthorizedError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineUnauthorizedError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineUnauthorizedError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineUnauthorizedError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

/// EngineUnprocessableError response body.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct EngineUnprocessableError {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "code")]
    #[validate(custom(function = "check_xss_string"))]
    pub code: String,

    #[serde(rename = "message")]
    #[validate(custom(function = "check_xss_string"))]
    pub message: String,
}

impl EngineUnprocessableError {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(code: String, message: String) -> EngineUnprocessableError {
        EngineUnprocessableError { code, message }
    }
}

/// Converts the EngineUnprocessableError value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for EngineUnprocessableError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("code".to_string()),
            Some(self.code.to_string()),
            Some("message".to_string()),
            Some(self.message.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a EngineUnprocessableError value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for EngineUnprocessableError {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub code: Vec<String>,
            pub message: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing EngineUnprocessableError".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "code" => intermediate_rep.code.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "message" => intermediate_rep.message.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing EngineUnprocessableError".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(EngineUnprocessableError {
            code: intermediate_rep
                .code
                .into_iter()
                .next()
                .ok_or_else(|| "code missing in EngineUnprocessableError".to_string())?,
            message: intermediate_rep
                .message
                .into_iter()
                .next()
                .ok_or_else(|| "message missing in EngineUnprocessableError".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<EngineUnprocessableError> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<EngineUnprocessableError>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<EngineUnprocessableError>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for EngineUnprocessableError - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<EngineUnprocessableError> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <EngineUnprocessableError as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into EngineUnprocessableError - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportInfoResult {
    #[serde(rename = "presets")]
    #[validate(nested)]
    pub presets: Vec<models::ExportPreset>,
}

impl ExportInfoResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(presets: Vec<models::ExportPreset>) -> ExportInfoResult {
        ExportInfoResult { presets }
    }
}

/// Converts the ExportInfoResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportInfoResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping presets in query parameter serialization

        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportInfoResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportInfoResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub presets: Vec<Vec<models::ExportPreset>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportInfoResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    "presets" => return std::result::Result::Err(
                        "Parsing a container in this style is not supported in ExportInfoResult"
                            .to_string(),
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportInfoResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportInfoResult {
            presets: intermediate_rep
                .presets
                .into_iter()
                .next()
                .ok_or_else(|| "presets missing in ExportInfoResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportInfoResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportInfoResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportInfoResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportInfoResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportInfoResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportInfoResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportInfoResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportPreset {
    #[serde(rename = "id")]
    #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    #[serde(rename = "name")]
    #[validate(custom(function = "check_xss_string"))]
    pub name: String,

    #[serde(rename = "width")]
    pub width: i32,

    #[serde(rename = "height")]
    pub height: i32,

    #[serde(rename = "fps")]
    pub fps: i32,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "fileType")]
    #[validate(custom(function = "check_xss_string"))]
    pub file_type: String,
}

impl ExportPreset {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        id: String,
        name: String,
        width: i32,
        height: i32,
        fps: i32,
        file_type: String,
    ) -> ExportPreset {
        ExportPreset {
            id,
            name,
            width,
            height,
            fps,
            file_type,
        }
    }
}

/// Converts the ExportPreset value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportPreset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("name".to_string()),
            Some(self.name.to_string()),
            Some("width".to_string()),
            Some(self.width.to_string()),
            Some("height".to_string()),
            Some(self.height.to_string()),
            Some("fps".to_string()),
            Some(self.fps.to_string()),
            Some("fileType".to_string()),
            Some(self.file_type.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportPreset value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportPreset {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<String>,
            pub name: Vec<String>,
            pub width: Vec<i32>,
            pub height: Vec<i32>,
            pub fps: Vec<i32>,
            pub file_type: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportPreset".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "name" => intermediate_rep.name.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "width" => intermediate_rep.width.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "height" => intermediate_rep.height.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "fps" => intermediate_rep.fps.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "fileType" => intermediate_rep.file_type.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportPreset".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportPreset {
            id: intermediate_rep
                .id
                .into_iter()
                .next()
                .ok_or_else(|| "id missing in ExportPreset".to_string())?,
            name: intermediate_rep
                .name
                .into_iter()
                .next()
                .ok_or_else(|| "name missing in ExportPreset".to_string())?,
            width: intermediate_rep
                .width
                .into_iter()
                .next()
                .ok_or_else(|| "width missing in ExportPreset".to_string())?,
            height: intermediate_rep
                .height
                .into_iter()
                .next()
                .ok_or_else(|| "height missing in ExportPreset".to_string())?,
            fps: intermediate_rep
                .fps
                .into_iter()
                .next()
                .ok_or_else(|| "fps missing in ExportPreset".to_string())?,
            file_type: intermediate_rep
                .file_type
                .into_iter()
                .next()
                .ok_or_else(|| "fileType missing in ExportPreset".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportPreset> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportPreset>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportPreset>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportPreset - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportPreset> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportPreset as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportPreset - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunCutPlanPayload {
    #[serde(rename = "outputURL")]
    #[validate(custom(function = "check_xss_string"))]
    pub output_url: String,

    #[serde(rename = "presetId")]
    #[validate(custom(function = "check_xss_string"))]
    pub preset_id: String,

    #[serde(rename = "jobId")]
    #[validate(custom(function = "check_xss_string"))]
    pub job_id: String,
}

impl ExportRunCutPlanPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(output_url: String, preset_id: String, job_id: String) -> ExportRunCutPlanPayload {
        ExportRunCutPlanPayload {
            output_url,
            preset_id,
            job_id,
        }
    }
}

/// Converts the ExportRunCutPlanPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunCutPlanPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("outputURL".to_string()),
            Some(self.output_url.to_string()),
            Some("presetId".to_string()),
            Some(self.preset_id.to_string()),
            Some("jobId".to_string()),
            Some(self.job_id.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunCutPlanPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunCutPlanPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub output_url: Vec<String>,
            pub preset_id: Vec<String>,
            pub job_id: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunCutPlanPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "outputURL" => intermediate_rep.output_url.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "presetId" => intermediate_rep.preset_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "jobId" => intermediate_rep.job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunCutPlanPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunCutPlanPayload {
            output_url: intermediate_rep
                .output_url
                .into_iter()
                .next()
                .ok_or_else(|| "outputURL missing in ExportRunCutPlanPayload".to_string())?,
            preset_id: intermediate_rep
                .preset_id
                .into_iter()
                .next()
                .ok_or_else(|| "presetId missing in ExportRunCutPlanPayload".to_string())?,
            job_id: intermediate_rep
                .job_id
                .into_iter()
                .next()
                .ok_or_else(|| "jobId missing in ExportRunCutPlanPayload".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunCutPlanPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunCutPlanPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunCutPlanPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunCutPlanPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportRunCutPlanPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunCutPlanPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunCutPlanPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunCutPlanResult {
    #[serde(rename = "jobId")]
    #[validate(custom(function = "check_xss_string"))]
    pub job_id: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
    #[validate(custom(function = "check_xss_string"))]
    pub status: String,

    #[serde(rename = "outputURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_url: Option<String>,

    #[serde(rename = "appliedSegments")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied_segments: Option<i32>,
}

impl ExportRunCutPlanResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(job_id: String, status: String) -> ExportRunCutPlanResult {
        ExportRunCutPlanResult {
            job_id,
            status,
            output_url: None,
            applied_segments: None,
        }
    }
}

/// Converts the ExportRunCutPlanResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunCutPlanResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("jobId".to_string()),
            Some(self.job_id.to_string()),
            Some("status".to_string()),
            Some(self.status.to_string()),
            self.output_url
                .as_ref()
                .map(|output_url| ["outputURL".to_string(), output_url.to_string()].join(",")),
            self.applied_segments.as_ref().map(|applied_segments| {
                ["appliedSegments".to_string(), applied_segments.to_string()].join(",")
            }),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunCutPlanResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunCutPlanResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub job_id: Vec<String>,
            pub status: Vec<String>,
            pub output_url: Vec<String>,
            pub applied_segments: Vec<i32>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunCutPlanResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "jobId" => intermediate_rep.job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "outputURL" => intermediate_rep.output_url.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "appliedSegments" => intermediate_rep.applied_segments.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunCutPlanResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunCutPlanResult {
            job_id: intermediate_rep
                .job_id
                .into_iter()
                .next()
                .ok_or_else(|| "jobId missing in ExportRunCutPlanResult".to_string())?,
            status: intermediate_rep
                .status
                .into_iter()
                .next()
                .ok_or_else(|| "status missing in ExportRunCutPlanResult".to_string())?,
            output_url: intermediate_rep.output_url.into_iter().next(),
            applied_segments: intermediate_rep.applied_segments.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunCutPlanResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunCutPlanResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunCutPlanResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunCutPlanResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportRunCutPlanResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunCutPlanResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunCutPlanResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunPayload {
    #[serde(rename = "outputURL")]
    #[validate(custom(function = "check_xss_string"))]
    pub output_url: String,

    #[serde(rename = "presetId")]
    #[validate(custom(function = "check_xss_string"))]
    pub preset_id: String,

    #[serde(rename = "trimStartSeconds")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trim_start_seconds: Option<f64>,

    #[serde(rename = "trimEndSeconds")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trim_end_seconds: Option<f64>,

    #[serde(rename = "timeline")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeline: Option<models::ExportRunPayloadTimeline>,

    #[serde(rename = "backgroundFraming")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_framing: Option<models::BackgroundFramingSettings>,
}

impl ExportRunPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(output_url: String, preset_id: String) -> ExportRunPayload {
        ExportRunPayload {
            output_url,
            preset_id,
            trim_start_seconds: None,
            trim_end_seconds: None,
            timeline: None,
            background_framing: None,
        }
    }
}

/// Converts the ExportRunPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("outputURL".to_string()),
            Some(self.output_url.to_string()),
            Some("presetId".to_string()),
            Some(self.preset_id.to_string()),
            self.trim_start_seconds.as_ref().map(|trim_start_seconds| {
                [
                    "trimStartSeconds".to_string(),
                    trim_start_seconds.to_string(),
                ]
                .join(",")
            }),
            self.trim_end_seconds.as_ref().map(|trim_end_seconds| {
                ["trimEndSeconds".to_string(), trim_end_seconds.to_string()].join(",")
            }),
            // Skipping timeline in query parameter serialization

            // Skipping backgroundFraming in query parameter serialization
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub output_url: Vec<String>,
            pub preset_id: Vec<String>,
            pub trim_start_seconds: Vec<f64>,
            pub trim_end_seconds: Vec<f64>,
            pub timeline: Vec<models::ExportRunPayloadTimeline>,
            pub background_framing: Vec<models::BackgroundFramingSettings>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "outputURL" => intermediate_rep.output_url.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "presetId" => intermediate_rep.preset_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "trimStartSeconds" => intermediate_rep.trim_start_seconds.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "trimEndSeconds" => intermediate_rep.trim_end_seconds.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "timeline" => intermediate_rep.timeline.push(
                        <models::ExportRunPayloadTimeline as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "backgroundFraming" => intermediate_rep.background_framing.push(
                        <models::BackgroundFramingSettings as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunPayload {
            output_url: intermediate_rep
                .output_url
                .into_iter()
                .next()
                .ok_or_else(|| "outputURL missing in ExportRunPayload".to_string())?,
            preset_id: intermediate_rep
                .preset_id
                .into_iter()
                .next()
                .ok_or_else(|| "presetId missing in ExportRunPayload".to_string())?,
            trim_start_seconds: intermediate_rep.trim_start_seconds.into_iter().next(),
            trim_end_seconds: intermediate_rep.trim_end_seconds.into_iter().next(),
            timeline: intermediate_rep.timeline.into_iter().next(),
            background_framing: intermediate_rep.background_framing.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportRunPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunPayloadTimeline {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "version")]
    pub version: f64,

    #[serde(rename = "items")]
    #[validate(nested)]
    pub items: Vec<models::ExportRunPayloadTimelineItemsInner>,

    #[serde(rename = "updatedAt")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl ExportRunPayloadTimeline {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        version: f64,
        items: Vec<models::ExportRunPayloadTimelineItemsInner>,
    ) -> ExportRunPayloadTimeline {
        ExportRunPayloadTimeline {
            version,
            items,
            updated_at: None,
        }
    }
}

/// Converts the ExportRunPayloadTimeline value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunPayloadTimeline {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("version".to_string()),
            Some(self.version.to_string()),
            // Skipping items in query parameter serialization
            self.updated_at
                .as_ref()
                .map(|updated_at| ["updatedAt".to_string(), updated_at.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunPayloadTimeline value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunPayloadTimeline {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub version: Vec<f64>,
            pub items: Vec<Vec<models::ExportRunPayloadTimelineItemsInner>>,
            pub updated_at: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunPayloadTimeline".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "version" => intermediate_rep.version.push(<f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    "items" => return std::result::Result::Err("Parsing a container in this style is not supported in ExportRunPayloadTimeline".to_string()),
                    #[allow(clippy::redundant_clone)]
                    "updatedAt" => intermediate_rep.updated_at.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing ExportRunPayloadTimeline".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunPayloadTimeline {
            version: intermediate_rep
                .version
                .into_iter()
                .next()
                .ok_or_else(|| "version missing in ExportRunPayloadTimeline".to_string())?,
            items: intermediate_rep
                .items
                .into_iter()
                .next()
                .ok_or_else(|| "items missing in ExportRunPayloadTimeline".to_string())?,
            updated_at: intermediate_rep.updated_at.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunPayloadTimeline> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunPayloadTimeline>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunPayloadTimeline>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunPayloadTimeline - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportRunPayloadTimeline> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunPayloadTimeline as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunPayloadTimeline - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
#[allow(non_camel_case_types, clippy::large_enum_variant)]
pub enum ExportRunPayloadTimelineItemsInner {
    ExportRunPayloadTimelineItemsInnerAnyOf(models::ExportRunPayloadTimelineItemsInnerAnyOf),
    ExportRunPayloadTimelineItemsInnerAnyOf1(models::ExportRunPayloadTimelineItemsInnerAnyOf1),
}

impl validator::Validate for ExportRunPayloadTimelineItemsInner {
    fn validate(&self) -> std::result::Result<(), validator::ValidationErrors> {
        match self {
            Self::ExportRunPayloadTimelineItemsInnerAnyOf(v) => v.validate(),
            Self::ExportRunPayloadTimelineItemsInnerAnyOf1(v) => v.validate(),
        }
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunPayloadTimelineItemsInner value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunPayloadTimelineItemsInner {
    type Err = serde_json::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        serde_json::from_str(s)
    }
}

impl From<models::ExportRunPayloadTimelineItemsInnerAnyOf> for ExportRunPayloadTimelineItemsInner {
    fn from(value: models::ExportRunPayloadTimelineItemsInnerAnyOf) -> Self {
        Self::ExportRunPayloadTimelineItemsInnerAnyOf(value)
    }
}
impl From<models::ExportRunPayloadTimelineItemsInnerAnyOf1> for ExportRunPayloadTimelineItemsInner {
    fn from(value: models::ExportRunPayloadTimelineItemsInnerAnyOf1) -> Self {
        Self::ExportRunPayloadTimelineItemsInnerAnyOf1(value)
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunPayloadTimelineItemsInnerAnyOf {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "kind")]
    #[validate(custom(function = "check_xss_string"))]
    pub kind: String,

    #[serde(rename = "id")]
    #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "sourceAssetId")]
    #[validate(custom(function = "check_xss_string"))]
    pub source_asset_id: String,

    #[serde(rename = "sourceStartSeconds")]
    pub source_start_seconds: f64,

    #[serde(rename = "sourceEndSeconds")]
    pub source_end_seconds: f64,
}

impl ExportRunPayloadTimelineItemsInnerAnyOf {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        kind: String,
        id: String,
        source_asset_id: String,
        source_start_seconds: f64,
        source_end_seconds: f64,
    ) -> ExportRunPayloadTimelineItemsInnerAnyOf {
        ExportRunPayloadTimelineItemsInnerAnyOf {
            kind,
            id,
            source_asset_id,
            source_start_seconds,
            source_end_seconds,
        }
    }
}

/// Converts the ExportRunPayloadTimelineItemsInnerAnyOf value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunPayloadTimelineItemsInnerAnyOf {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("kind".to_string()),
            Some(self.kind.to_string()),
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("sourceAssetId".to_string()),
            Some(self.source_asset_id.to_string()),
            Some("sourceStartSeconds".to_string()),
            Some(self.source_start_seconds.to_string()),
            Some("sourceEndSeconds".to_string()),
            Some(self.source_end_seconds.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunPayloadTimelineItemsInnerAnyOf value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunPayloadTimelineItemsInnerAnyOf {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub kind: Vec<String>,
            pub id: Vec<String>,
            pub source_asset_id: Vec<String>,
            pub source_start_seconds: Vec<f64>,
            pub source_end_seconds: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunPayloadTimelineItemsInnerAnyOf"
                            .to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "kind" => intermediate_rep.kind.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "sourceAssetId" => intermediate_rep.source_asset_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "sourceStartSeconds" => intermediate_rep.source_start_seconds.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "sourceEndSeconds" => intermediate_rep.source_end_seconds.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunPayloadTimelineItemsInnerAnyOf"
                                .to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunPayloadTimelineItemsInnerAnyOf {
            kind: intermediate_rep.kind.into_iter().next().ok_or_else(|| {
                "kind missing in ExportRunPayloadTimelineItemsInnerAnyOf".to_string()
            })?,
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| {
                "id missing in ExportRunPayloadTimelineItemsInnerAnyOf".to_string()
            })?,
            source_asset_id: intermediate_rep
                .source_asset_id
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "sourceAssetId missing in ExportRunPayloadTimelineItemsInnerAnyOf".to_string()
                })?,
            source_start_seconds: intermediate_rep
                .source_start_seconds
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "sourceStartSeconds missing in ExportRunPayloadTimelineItemsInnerAnyOf"
                        .to_string()
                })?,
            source_end_seconds: intermediate_rep
                .source_end_seconds
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "sourceEndSeconds missing in ExportRunPayloadTimelineItemsInnerAnyOf"
                        .to_string()
                })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunPayloadTimelineItemsInnerAnyOf - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunPayloadTimelineItemsInnerAnyOf as std::str::FromStr>::from_str(
                    value,
                ) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunPayloadTimelineItemsInnerAnyOf - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunPayloadTimelineItemsInnerAnyOf1 {
    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "kind")]
    #[validate(custom(function = "check_xss_string"))]
    pub kind: String,

    #[serde(rename = "id")]
    #[validate(custom(function = "check_xss_string"))]
    pub id: String,

    #[serde(rename = "durationSeconds")]
    pub duration_seconds: f64,
}

impl ExportRunPayloadTimelineItemsInnerAnyOf1 {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        kind: String,
        id: String,
        duration_seconds: f64,
    ) -> ExportRunPayloadTimelineItemsInnerAnyOf1 {
        ExportRunPayloadTimelineItemsInnerAnyOf1 {
            kind,
            id,
            duration_seconds,
        }
    }
}

/// Converts the ExportRunPayloadTimelineItemsInnerAnyOf1 value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunPayloadTimelineItemsInnerAnyOf1 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("kind".to_string()),
            Some(self.kind.to_string()),
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("durationSeconds".to_string()),
            Some(self.duration_seconds.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunPayloadTimelineItemsInnerAnyOf1 value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunPayloadTimelineItemsInnerAnyOf1 {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub kind: Vec<String>,
            pub id: Vec<String>,
            pub duration_seconds: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunPayloadTimelineItemsInnerAnyOf1"
                            .to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "kind" => intermediate_rep.kind.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "durationSeconds" => intermediate_rep.duration_seconds.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunPayloadTimelineItemsInnerAnyOf1"
                                .to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunPayloadTimelineItemsInnerAnyOf1 {
            kind: intermediate_rep.kind.into_iter().next().ok_or_else(|| {
                "kind missing in ExportRunPayloadTimelineItemsInnerAnyOf1".to_string()
            })?,
            id: intermediate_rep.id.into_iter().next().ok_or_else(|| {
                "id missing in ExportRunPayloadTimelineItemsInnerAnyOf1".to_string()
            })?,
            duration_seconds: intermediate_rep
                .duration_seconds
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "durationSeconds missing in ExportRunPayloadTimelineItemsInnerAnyOf1"
                        .to_string()
                })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf1> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf1>>
    for HeaderValue
{
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf1>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunPayloadTimelineItemsInnerAnyOf1 - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue>
    for header::IntoHeaderValue<ExportRunPayloadTimelineItemsInnerAnyOf1>
{
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunPayloadTimelineItemsInnerAnyOf1 as std::str::FromStr>::from_str(
                    value,
                ) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunPayloadTimelineItemsInnerAnyOf1 - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ExportRunResult {
    #[serde(rename = "jobId")]
    #[validate(custom(function = "check_xss_string"))]
    pub job_id: String,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "status")]
    #[validate(custom(function = "check_xss_string"))]
    pub status: String,

    #[serde(rename = "outputURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_url: Option<String>,
}

impl ExportRunResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(job_id: String, status: String) -> ExportRunResult {
        ExportRunResult {
            job_id,
            status,
            output_url: None,
        }
    }
}

/// Converts the ExportRunResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ExportRunResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("jobId".to_string()),
            Some(self.job_id.to_string()),
            Some("status".to_string()),
            Some(self.status.to_string()),
            self.output_url
                .as_ref()
                .map(|output_url| ["outputURL".to_string(), output_url.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ExportRunResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ExportRunResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub job_id: Vec<String>,
            pub status: Vec<String>,
            pub output_url: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ExportRunResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "jobId" => intermediate_rep.job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "status" => intermediate_rep.status.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "outputURL" => intermediate_rep.output_url.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ExportRunResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ExportRunResult {
            job_id: intermediate_rep
                .job_id
                .into_iter()
                .next()
                .ok_or_else(|| "jobId missing in ExportRunResult".to_string())?,
            status: intermediate_rep
                .status
                .into_iter()
                .next()
                .ok_or_else(|| "status missing in ExportRunResult".to_string())?,
            output_url: intermediate_rep.output_url.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ExportRunResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ExportRunResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ExportRunResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ExportRunResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ExportRunResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ExportRunResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ExportRunResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct PermissionsResult {
    #[serde(rename = "screenRecordingGranted")]
    pub screen_recording_granted: bool,

    #[serde(rename = "microphoneGranted")]
    pub microphone_granted: bool,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "inputMonitoring")]
    #[validate(custom(function = "check_xss_string"))]
    pub input_monitoring: String,
}

impl PermissionsResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        screen_recording_granted: bool,
        microphone_granted: bool,
        input_monitoring: String,
    ) -> PermissionsResult {
        PermissionsResult {
            screen_recording_granted,
            microphone_granted,
            input_monitoring,
        }
    }
}

/// Converts the PermissionsResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for PermissionsResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("screenRecordingGranted".to_string()),
            Some(self.screen_recording_granted.to_string()),
            Some("microphoneGranted".to_string()),
            Some(self.microphone_granted.to_string()),
            Some("inputMonitoring".to_string()),
            Some(self.input_monitoring.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a PermissionsResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for PermissionsResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub screen_recording_granted: Vec<bool>,
            pub microphone_granted: Vec<bool>,
            pub input_monitoring: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing PermissionsResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "screenRecordingGranted" => intermediate_rep.screen_recording_granted.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "microphoneGranted" => intermediate_rep.microphone_granted.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "inputMonitoring" => intermediate_rep.input_monitoring.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing PermissionsResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(PermissionsResult {
            screen_recording_granted: intermediate_rep
                .screen_recording_granted
                .into_iter()
                .next()
                .ok_or_else(|| "screenRecordingGranted missing in PermissionsResult".to_string())?,
            microphone_granted: intermediate_rep
                .microphone_granted
                .into_iter()
                .next()
                .ok_or_else(|| "microphoneGranted missing in PermissionsResult".to_string())?,
            input_monitoring: intermediate_rep
                .input_monitoring
                .into_iter()
                .next()
                .ok_or_else(|| "inputMonitoring missing in PermissionsResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<PermissionsResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<PermissionsResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<PermissionsResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for PermissionsResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<PermissionsResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <PermissionsResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into PermissionsResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct PingResult {
    #[serde(rename = "app")]
    #[validate(custom(function = "check_xss_string"))]
    pub app: String,

    #[serde(rename = "engineVersion")]
    #[validate(custom(function = "check_xss_string"))]
    pub engine_version: String,

    #[serde(rename = "protocolVersion")]
    #[validate(custom(function = "check_xss_string"))]
    pub protocol_version: String,

    #[serde(rename = "platform")]
    #[validate(custom(function = "check_xss_string"))]
    pub platform: String,
}

impl PingResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        app: String,
        engine_version: String,
        protocol_version: String,
        platform: String,
    ) -> PingResult {
        PingResult {
            app,
            engine_version,
            protocol_version,
            platform,
        }
    }
}

/// Converts the PingResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for PingResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("app".to_string()),
            Some(self.app.to_string()),
            Some("engineVersion".to_string()),
            Some(self.engine_version.to_string()),
            Some("protocolVersion".to_string()),
            Some(self.protocol_version.to_string()),
            Some("platform".to_string()),
            Some(self.platform.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a PingResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for PingResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub app: Vec<String>,
            pub engine_version: Vec<String>,
            pub protocol_version: Vec<String>,
            pub platform: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing PingResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "app" => intermediate_rep.app.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "engineVersion" => intermediate_rep.engine_version.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "protocolVersion" => intermediate_rep.protocol_version.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "platform" => intermediate_rep.platform.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing PingResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(PingResult {
            app: intermediate_rep
                .app
                .into_iter()
                .next()
                .ok_or_else(|| "app missing in PingResult".to_string())?,
            engine_version: intermediate_rep
                .engine_version
                .into_iter()
                .next()
                .ok_or_else(|| "engineVersion missing in PingResult".to_string())?,
            protocol_version: intermediate_rep
                .protocol_version
                .into_iter()
                .next()
                .ok_or_else(|| "protocolVersion missing in PingResult".to_string())?,
            platform: intermediate_rep
                .platform
                .into_iter()
                .next()
                .ok_or_else(|| "platform missing in PingResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<PingResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<PingResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<PingResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for PingResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<PingResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <PingResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into PingResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectAgentAnalysisSummary {
    #[serde(rename = "latestJobId")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_job_id: Option<String>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "latestStatus")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_status: Option<String>,

    #[serde(rename = "qaPassed")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qa_passed: Option<bool>,

    #[serde(rename = "updatedAt")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl ProjectAgentAnalysisSummary {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> ProjectAgentAnalysisSummary {
        ProjectAgentAnalysisSummary {
            latest_job_id: None,
            latest_status: None,
            qa_passed: None,
            updated_at: None,
        }
    }
}

/// Converts the ProjectAgentAnalysisSummary value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectAgentAnalysisSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.latest_job_id.as_ref().map(|latest_job_id| {
                ["latestJobId".to_string(), latest_job_id.to_string()].join(",")
            }),
            self.latest_status.as_ref().map(|latest_status| {
                ["latestStatus".to_string(), latest_status.to_string()].join(",")
            }),
            self.qa_passed
                .as_ref()
                .map(|qa_passed| ["qaPassed".to_string(), qa_passed.to_string()].join(",")),
            self.updated_at
                .as_ref()
                .map(|updated_at| ["updatedAt".to_string(), updated_at.to_string()].join(",")),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectAgentAnalysisSummary value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectAgentAnalysisSummary {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub latest_job_id: Vec<String>,
            pub latest_status: Vec<String>,
            pub qa_passed: Vec<bool>,
            pub updated_at: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectAgentAnalysisSummary".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "latestJobId" => intermediate_rep.latest_job_id.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "latestStatus" => intermediate_rep.latest_status.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "qaPassed" => intermediate_rep.qa_passed.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "updatedAt" => intermediate_rep.updated_at.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ProjectAgentAnalysisSummary".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectAgentAnalysisSummary {
            latest_job_id: intermediate_rep.latest_job_id.into_iter().next(),
            latest_status: intermediate_rep.latest_status.into_iter().next(),
            qa_passed: intermediate_rep.qa_passed.into_iter().next(),
            updated_at: intermediate_rep.updated_at.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectAgentAnalysisSummary> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectAgentAnalysisSummary>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectAgentAnalysisSummary>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectAgentAnalysisSummary - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectAgentAnalysisSummary> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectAgentAnalysisSummary as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectAgentAnalysisSummary - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectOpenPayload {
    #[serde(rename = "projectPath")]
    #[validate(custom(function = "check_xss_string"))]
    pub project_path: String,
}

impl ProjectOpenPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(project_path: String) -> ProjectOpenPayload {
        ProjectOpenPayload { project_path }
    }
}

/// Converts the ProjectOpenPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectOpenPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("projectPath".to_string()),
            Some(self.project_path.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectOpenPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectOpenPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub project_path: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectOpenPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "projectPath" => intermediate_rep.project_path.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ProjectOpenPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectOpenPayload {
            project_path: intermediate_rep
                .project_path
                .into_iter()
                .next()
                .ok_or_else(|| "projectPath missing in ProjectOpenPayload".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectOpenPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectOpenPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectOpenPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectOpenPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectOpenPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectOpenPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectOpenPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectRecentItem {
    #[serde(rename = "projectPath")]
    #[validate(custom(function = "check_xss_string"))]
    pub project_path: String,

    #[serde(rename = "displayName")]
    #[validate(custom(function = "check_xss_string"))]
    pub display_name: String,

    #[serde(rename = "lastOpenedAt")]
    #[validate(custom(function = "check_xss_string"))]
    pub last_opened_at: String,
}

impl ProjectRecentItem {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        project_path: String,
        display_name: String,
        last_opened_at: String,
    ) -> ProjectRecentItem {
        ProjectRecentItem {
            project_path,
            display_name,
            last_opened_at,
        }
    }
}

/// Converts the ProjectRecentItem value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectRecentItem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("projectPath".to_string()),
            Some(self.project_path.to_string()),
            Some("displayName".to_string()),
            Some(self.display_name.to_string()),
            Some("lastOpenedAt".to_string()),
            Some(self.last_opened_at.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectRecentItem value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectRecentItem {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub project_path: Vec<String>,
            pub display_name: Vec<String>,
            pub last_opened_at: Vec<String>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectRecentItem".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "projectPath" => intermediate_rep.project_path.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "displayName" => intermediate_rep.display_name.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "lastOpenedAt" => intermediate_rep.last_opened_at.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ProjectRecentItem".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectRecentItem {
            project_path: intermediate_rep
                .project_path
                .into_iter()
                .next()
                .ok_or_else(|| "projectPath missing in ProjectRecentItem".to_string())?,
            display_name: intermediate_rep
                .display_name
                .into_iter()
                .next()
                .ok_or_else(|| "displayName missing in ProjectRecentItem".to_string())?,
            last_opened_at: intermediate_rep
                .last_opened_at
                .into_iter()
                .next()
                .ok_or_else(|| "lastOpenedAt missing in ProjectRecentItem".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectRecentItem> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectRecentItem>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectRecentItem>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectRecentItem - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectRecentItem> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectRecentItem as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectRecentItem - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectRecentsResult {
    #[serde(rename = "items")]
    #[validate(nested)]
    pub items: Vec<models::ProjectRecentItem>,
}

impl ProjectRecentsResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(items: Vec<models::ProjectRecentItem>) -> ProjectRecentsResult {
        ProjectRecentsResult { items }
    }
}

/// Converts the ProjectRecentsResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectRecentsResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping items in query parameter serialization

        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectRecentsResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectRecentsResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub items: Vec<Vec<models::ProjectRecentItem>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectRecentsResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    "items" => return std::result::Result::Err("Parsing a container in this style is not supported in ProjectRecentsResult".to_string()),
                    _ => return std::result::Result::Err("Unexpected key while parsing ProjectRecentsResult".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectRecentsResult {
            items: intermediate_rep
                .items
                .into_iter()
                .next()
                .ok_or_else(|| "items missing in ProjectRecentsResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectRecentsResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectRecentsResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectRecentsResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectRecentsResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectRecentsResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectRecentsResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectRecentsResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectSavePayload {
    #[serde(rename = "projectPath")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,

    #[serde(rename = "autoZoom")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_zoom: Option<models::ProjectStateAutoZoom>,

    #[serde(rename = "backgroundFraming")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_framing: Option<models::BackgroundFramingSettings>,

    #[serde(rename = "timeline")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeline: Option<models::ExportRunPayloadTimeline>,
}

impl ProjectSavePayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> ProjectSavePayload {
        ProjectSavePayload {
            project_path: None,
            auto_zoom: None,
            background_framing: None,
            timeline: None,
        }
    }
}

/// Converts the ProjectSavePayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectSavePayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.project_path.as_ref().map(|project_path| {
                ["projectPath".to_string(), project_path.to_string()].join(",")
            }),
            // Skipping autoZoom in query parameter serialization

            // Skipping backgroundFraming in query parameter serialization

            // Skipping timeline in query parameter serialization
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectSavePayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectSavePayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub project_path: Vec<String>,
            pub auto_zoom: Vec<models::ProjectStateAutoZoom>,
            pub background_framing: Vec<models::BackgroundFramingSettings>,
            pub timeline: Vec<models::ExportRunPayloadTimeline>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectSavePayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "projectPath" => intermediate_rep.project_path.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "autoZoom" => intermediate_rep.auto_zoom.push(
                        <models::ProjectStateAutoZoom as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "backgroundFraming" => intermediate_rep.background_framing.push(
                        <models::BackgroundFramingSettings as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "timeline" => intermediate_rep.timeline.push(
                        <models::ExportRunPayloadTimeline as std::str::FromStr>::from_str(val)
                            .map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ProjectSavePayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectSavePayload {
            project_path: intermediate_rep.project_path.into_iter().next(),
            auto_zoom: intermediate_rep.auto_zoom.into_iter().next(),
            background_framing: intermediate_rep.background_framing.into_iter().next(),
            timeline: intermediate_rep.timeline.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectSavePayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectSavePayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectSavePayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectSavePayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectSavePayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectSavePayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectSavePayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectState {
    #[serde(rename = "projectPath")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,

    #[serde(rename = "recordingURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_url: Option<String>,

    #[serde(rename = "eventsURL")]
    #[validate(custom(function = "check_xss_string"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events_url: Option<String>,

    #[serde(rename = "lastRecordingTelemetry")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_recording_telemetry: Option<models::CaptureTelemetry>,

    #[serde(rename = "autoZoom")]
    #[validate(nested)]
    pub auto_zoom: models::ProjectStateAutoZoom,

    #[serde(rename = "backgroundFraming")]
    #[validate(nested)]
    pub background_framing: models::BackgroundFramingSettings,

    #[serde(rename = "timeline")]
    #[validate(nested)]
    pub timeline: models::ExportRunPayloadTimeline,

    #[serde(rename = "captureMetadata")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_metadata: Option<models::CaptureStatusResultCaptureMetadata>,

    #[serde(rename = "agentAnalysis")]
    #[validate(nested)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_analysis: Option<models::ProjectAgentAnalysisSummary>,
}

impl ProjectState {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        auto_zoom: models::ProjectStateAutoZoom,
        background_framing: models::BackgroundFramingSettings,
        timeline: models::ExportRunPayloadTimeline,
    ) -> ProjectState {
        ProjectState {
            project_path: None,
            recording_url: None,
            events_url: None,
            last_recording_telemetry: None,
            auto_zoom,
            background_framing,
            timeline,
            capture_metadata: None,
            agent_analysis: None,
        }
    }
}

/// Converts the ProjectState value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            self.project_path.as_ref().map(|project_path| {
                ["projectPath".to_string(), project_path.to_string()].join(",")
            }),
            self.recording_url.as_ref().map(|recording_url| {
                ["recordingURL".to_string(), recording_url.to_string()].join(",")
            }),
            self.events_url
                .as_ref()
                .map(|events_url| ["eventsURL".to_string(), events_url.to_string()].join(",")),
            // Skipping lastRecordingTelemetry in query parameter serialization

            // Skipping autoZoom in query parameter serialization

            // Skipping backgroundFraming in query parameter serialization

            // Skipping timeline in query parameter serialization

            // Skipping captureMetadata in query parameter serialization

            // Skipping agentAnalysis in query parameter serialization
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectState value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectState {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub project_path: Vec<String>,
            pub recording_url: Vec<String>,
            pub events_url: Vec<String>,
            pub last_recording_telemetry: Vec<models::CaptureTelemetry>,
            pub auto_zoom: Vec<models::ProjectStateAutoZoom>,
            pub background_framing: Vec<models::BackgroundFramingSettings>,
            pub timeline: Vec<models::ExportRunPayloadTimeline>,
            pub capture_metadata: Vec<models::CaptureStatusResultCaptureMetadata>,
            pub agent_analysis: Vec<models::ProjectAgentAnalysisSummary>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectState".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "projectPath" => intermediate_rep.project_path.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "recordingURL" => intermediate_rep.recording_url.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "eventsURL" => intermediate_rep.events_url.push(<String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "lastRecordingTelemetry" => intermediate_rep.last_recording_telemetry.push(<models::CaptureTelemetry as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "autoZoom" => intermediate_rep.auto_zoom.push(<models::ProjectStateAutoZoom as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "backgroundFraming" => intermediate_rep.background_framing.push(<models::BackgroundFramingSettings as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "timeline" => intermediate_rep.timeline.push(<models::ExportRunPayloadTimeline as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "captureMetadata" => intermediate_rep.capture_metadata.push(<models::CaptureStatusResultCaptureMetadata as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    #[allow(clippy::redundant_clone)]
                    "agentAnalysis" => intermediate_rep.agent_analysis.push(<models::ProjectAgentAnalysisSummary as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?),
                    _ => return std::result::Result::Err("Unexpected key while parsing ProjectState".to_string())
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectState {
            project_path: intermediate_rep.project_path.into_iter().next(),
            recording_url: intermediate_rep.recording_url.into_iter().next(),
            events_url: intermediate_rep.events_url.into_iter().next(),
            last_recording_telemetry: intermediate_rep.last_recording_telemetry.into_iter().next(),
            auto_zoom: intermediate_rep
                .auto_zoom
                .into_iter()
                .next()
                .ok_or_else(|| "autoZoom missing in ProjectState".to_string())?,
            background_framing: intermediate_rep
                .background_framing
                .into_iter()
                .next()
                .ok_or_else(|| "backgroundFraming missing in ProjectState".to_string())?,
            timeline: intermediate_rep
                .timeline
                .into_iter()
                .next()
                .ok_or_else(|| "timeline missing in ProjectState".to_string())?,
            capture_metadata: intermediate_rep.capture_metadata.into_iter().next(),
            agent_analysis: intermediate_rep.agent_analysis.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectState> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectState>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectState>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectState - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectState> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectState as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectState - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct ProjectStateAutoZoom {
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,

    #[serde(rename = "intensity")]
    pub intensity: f64,

    #[serde(rename = "minimumKeyframeInterval")]
    pub minimum_keyframe_interval: f64,
}

impl ProjectStateAutoZoom {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        is_enabled: bool,
        intensity: f64,
        minimum_keyframe_interval: f64,
    ) -> ProjectStateAutoZoom {
        ProjectStateAutoZoom {
            is_enabled,
            intensity,
            minimum_keyframe_interval,
        }
    }
}

/// Converts the ProjectStateAutoZoom value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for ProjectStateAutoZoom {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("isEnabled".to_string()),
            Some(self.is_enabled.to_string()),
            Some("intensity".to_string()),
            Some(self.intensity.to_string()),
            Some("minimumKeyframeInterval".to_string()),
            Some(self.minimum_keyframe_interval.to_string()),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a ProjectStateAutoZoom value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for ProjectStateAutoZoom {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub is_enabled: Vec<bool>,
            pub intensity: Vec<f64>,
            pub minimum_keyframe_interval: Vec<f64>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing ProjectStateAutoZoom".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "isEnabled" => intermediate_rep.is_enabled.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "intensity" => intermediate_rep.intensity.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "minimumKeyframeInterval" => intermediate_rep.minimum_keyframe_interval.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing ProjectStateAutoZoom".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(ProjectStateAutoZoom {
            is_enabled: intermediate_rep
                .is_enabled
                .into_iter()
                .next()
                .ok_or_else(|| "isEnabled missing in ProjectStateAutoZoom".to_string())?,
            intensity: intermediate_rep
                .intensity
                .into_iter()
                .next()
                .ok_or_else(|| "intensity missing in ProjectStateAutoZoom".to_string())?,
            minimum_keyframe_interval: intermediate_rep
                .minimum_keyframe_interval
                .into_iter()
                .next()
                .ok_or_else(|| {
                    "minimumKeyframeInterval missing in ProjectStateAutoZoom".to_string()
                })?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<ProjectStateAutoZoom> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<ProjectStateAutoZoom>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<ProjectStateAutoZoom>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for ProjectStateAutoZoom - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<ProjectStateAutoZoom> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <ProjectStateAutoZoom as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into ProjectStateAutoZoom - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct RecordingStartPayload {
    #[serde(rename = "trackInputEvents")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_input_events: Option<bool>,
}

impl RecordingStartPayload {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new() -> RecordingStartPayload {
        RecordingStartPayload {
            track_input_events: None,
        }
    }
}

/// Converts the RecordingStartPayload value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for RecordingStartPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> =
            vec![self.track_input_events.as_ref().map(|track_input_events| {
                [
                    "trackInputEvents".to_string(),
                    track_input_events.to_string(),
                ]
                .join(",")
            })];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a RecordingStartPayload value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for RecordingStartPayload {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub track_input_events: Vec<bool>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing RecordingStartPayload".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "trackInputEvents" => intermediate_rep.track_input_events.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing RecordingStartPayload".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(RecordingStartPayload {
            track_input_events: intermediate_rep.track_input_events.into_iter().next(),
        })
    }
}

// Methods for converting between header::IntoHeaderValue<RecordingStartPayload> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<RecordingStartPayload>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<RecordingStartPayload>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for RecordingStartPayload - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<RecordingStartPayload> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <RecordingStartPayload as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into RecordingStartPayload - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct SourcesResult {
    #[serde(rename = "displays")]
    #[validate(nested)]
    pub displays: Vec<models::DisplaySource>,

    #[serde(rename = "windows")]
    #[validate(nested)]
    pub windows: Vec<models::WindowSource>,
}

impl SourcesResult {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        displays: Vec<models::DisplaySource>,
        windows: Vec<models::WindowSource>,
    ) -> SourcesResult {
        SourcesResult { displays, windows }
    }
}

/// Converts the SourcesResult value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for SourcesResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            // Skipping displays in query parameter serialization

            // Skipping windows in query parameter serialization

        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a SourcesResult value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for SourcesResult {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub displays: Vec<Vec<models::DisplaySource>>,
            pub windows: Vec<Vec<models::WindowSource>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing SourcesResult".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    "displays" => {
                        return std::result::Result::Err(
                            "Parsing a container in this style is not supported in SourcesResult"
                                .to_string(),
                        );
                    }
                    "windows" => {
                        return std::result::Result::Err(
                            "Parsing a container in this style is not supported in SourcesResult"
                                .to_string(),
                        );
                    }
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing SourcesResult".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(SourcesResult {
            displays: intermediate_rep
                .displays
                .into_iter()
                .next()
                .ok_or_else(|| "displays missing in SourcesResult".to_string())?,
            windows: intermediate_rep
                .windows
                .into_iter()
                .next()
                .ok_or_else(|| "windows missing in SourcesResult".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<SourcesResult> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<SourcesResult>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<SourcesResult>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for SourcesResult - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<SourcesResult> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <SourcesResult as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into SourcesResult - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, validator::Validate)]
#[cfg_attr(feature = "conversion", derive(frunk::LabelledGeneric))]
pub struct WindowSource {
    #[serde(rename = "id")]
    pub id: i32,

    #[serde(rename = "title")]
    #[validate(custom(function = "check_xss_string"))]
    pub title: String,

    #[serde(rename = "appName")]
    #[validate(custom(function = "check_xss_string"))]
    pub app_name: String,

    #[serde(rename = "width")]
    pub width: f64,

    #[serde(rename = "height")]
    pub height: f64,

    #[serde(rename = "isOnScreen")]
    pub is_on_screen: bool,

    #[serde(rename = "pixelScale")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pixel_scale: Option<f64>,

    #[serde(rename = "refreshHz")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_hz: Option<f64>,

    /// Note: inline enums are not fully supported by openapi-generator
    #[serde(rename = "supportedCaptureFrameRates")]
    pub supported_capture_frame_rates: Vec<f64>,
}

impl WindowSource {
    #[allow(clippy::new_without_default, clippy::too_many_arguments)]
    pub fn new(
        id: i32,
        title: String,
        app_name: String,
        width: f64,
        height: f64,
        is_on_screen: bool,
        supported_capture_frame_rates: Vec<f64>,
    ) -> WindowSource {
        WindowSource {
            id,
            title,
            app_name,
            width,
            height,
            is_on_screen,
            pixel_scale: None,
            refresh_hz: None,
            supported_capture_frame_rates,
        }
    }
}

/// Converts the WindowSource value to the Query Parameters representation (style=form, explode=false)
/// specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde serializer
impl std::fmt::Display for WindowSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let params: Vec<Option<String>> = vec![
            Some("id".to_string()),
            Some(self.id.to_string()),
            Some("title".to_string()),
            Some(self.title.to_string()),
            Some("appName".to_string()),
            Some(self.app_name.to_string()),
            Some("width".to_string()),
            Some(self.width.to_string()),
            Some("height".to_string()),
            Some(self.height.to_string()),
            Some("isOnScreen".to_string()),
            Some(self.is_on_screen.to_string()),
            self.pixel_scale
                .as_ref()
                .map(|pixel_scale| ["pixelScale".to_string(), pixel_scale.to_string()].join(",")),
            self.refresh_hz
                .as_ref()
                .map(|refresh_hz| ["refreshHz".to_string(), refresh_hz.to_string()].join(",")),
            Some("supportedCaptureFrameRates".to_string()),
            Some(
                self.supported_capture_frame_rates
                    .iter()
                    .map(|x| x.to_string())
                    .collect::<Vec<_>>()
                    .join(","),
            ),
        ];

        write!(
            f,
            "{}",
            params.into_iter().flatten().collect::<Vec<_>>().join(",")
        )
    }
}

/// Converts Query Parameters representation (style=form, explode=false) to a WindowSource value
/// as specified in https://swagger.io/docs/specification/serialization/
/// Should be implemented in a serde deserializer
impl std::str::FromStr for WindowSource {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        /// An intermediate representation of the struct to use for parsing.
        #[derive(Default)]
        #[allow(dead_code)]
        struct IntermediateRep {
            pub id: Vec<i32>,
            pub title: Vec<String>,
            pub app_name: Vec<String>,
            pub width: Vec<f64>,
            pub height: Vec<f64>,
            pub is_on_screen: Vec<bool>,
            pub pixel_scale: Vec<f64>,
            pub refresh_hz: Vec<f64>,
            pub supported_capture_frame_rates: Vec<Vec<f64>>,
        }

        let mut intermediate_rep = IntermediateRep::default();

        // Parse into intermediate representation
        let mut string_iter = s.split(',');
        let mut key_result = string_iter.next();

        while key_result.is_some() {
            let val = match string_iter.next() {
                Some(x) => x,
                None => {
                    return std::result::Result::Err(
                        "Missing value while parsing WindowSource".to_string(),
                    );
                }
            };

            if let Some(key) = key_result {
                #[allow(clippy::match_single_binding)]
                match key {
                    #[allow(clippy::redundant_clone)]
                    "id" => intermediate_rep.id.push(
                        <i32 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "title" => intermediate_rep.title.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "appName" => intermediate_rep.app_name.push(
                        <String as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "width" => intermediate_rep.width.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "height" => intermediate_rep.height.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "isOnScreen" => intermediate_rep.is_on_screen.push(
                        <bool as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "pixelScale" => intermediate_rep.pixel_scale.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    #[allow(clippy::redundant_clone)]
                    "refreshHz" => intermediate_rep.refresh_hz.push(
                        <f64 as std::str::FromStr>::from_str(val).map_err(|x| x.to_string())?,
                    ),
                    "supportedCaptureFrameRates" => {
                        return std::result::Result::Err(
                            "Parsing a container in this style is not supported in WindowSource"
                                .to_string(),
                        );
                    }
                    _ => {
                        return std::result::Result::Err(
                            "Unexpected key while parsing WindowSource".to_string(),
                        );
                    }
                }
            }

            // Get the next key
            key_result = string_iter.next();
        }

        // Use the intermediate representation to return the struct
        std::result::Result::Ok(WindowSource {
            id: intermediate_rep
                .id
                .into_iter()
                .next()
                .ok_or_else(|| "id missing in WindowSource".to_string())?,
            title: intermediate_rep
                .title
                .into_iter()
                .next()
                .ok_or_else(|| "title missing in WindowSource".to_string())?,
            app_name: intermediate_rep
                .app_name
                .into_iter()
                .next()
                .ok_or_else(|| "appName missing in WindowSource".to_string())?,
            width: intermediate_rep
                .width
                .into_iter()
                .next()
                .ok_or_else(|| "width missing in WindowSource".to_string())?,
            height: intermediate_rep
                .height
                .into_iter()
                .next()
                .ok_or_else(|| "height missing in WindowSource".to_string())?,
            is_on_screen: intermediate_rep
                .is_on_screen
                .into_iter()
                .next()
                .ok_or_else(|| "isOnScreen missing in WindowSource".to_string())?,
            pixel_scale: intermediate_rep.pixel_scale.into_iter().next(),
            refresh_hz: intermediate_rep.refresh_hz.into_iter().next(),
            supported_capture_frame_rates: intermediate_rep
                .supported_capture_frame_rates
                .into_iter()
                .next()
                .ok_or_else(|| "supportedCaptureFrameRates missing in WindowSource".to_string())?,
        })
    }
}

// Methods for converting between header::IntoHeaderValue<WindowSource> and HeaderValue

#[cfg(feature = "server")]
impl std::convert::TryFrom<header::IntoHeaderValue<WindowSource>> for HeaderValue {
    type Error = String;

    fn try_from(
        hdr_value: header::IntoHeaderValue<WindowSource>,
    ) -> std::result::Result<Self, Self::Error> {
        let hdr_value = hdr_value.to_string();
        match HeaderValue::from_str(&hdr_value) {
            std::result::Result::Ok(value) => std::result::Result::Ok(value),
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Invalid header value for WindowSource - value: {hdr_value} is invalid {e}"#
            )),
        }
    }
}

#[cfg(feature = "server")]
impl std::convert::TryFrom<HeaderValue> for header::IntoHeaderValue<WindowSource> {
    type Error = String;

    fn try_from(hdr_value: HeaderValue) -> std::result::Result<Self, Self::Error> {
        match hdr_value.to_str() {
            std::result::Result::Ok(value) => {
                match <WindowSource as std::str::FromStr>::from_str(value) {
                    std::result::Result::Ok(value) => {
                        std::result::Result::Ok(header::IntoHeaderValue(value))
                    }
                    std::result::Result::Err(err) => std::result::Result::Err(format!(
                        r#"Unable to convert header value '{value}' into WindowSource - {err}"#
                    )),
                }
            }
            std::result::Result::Err(e) => std::result::Result::Err(format!(
                r#"Unable to convert header: {hdr_value:?} to string: {e}"#
            )),
        }
    }
}
