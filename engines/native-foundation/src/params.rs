use serde::Deserialize;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunParams {
    pub(crate) preflight_token: Option<String>,
    pub(crate) runtime_budget_minutes: Option<i64>,
    pub(crate) imported_transcript_path: Option<String>,
    pub(crate) force: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JobParams {
    pub(crate) job_id: Option<String>,
    pub(crate) destructive_intent: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CaptureStartParams {
    pub(crate) window_id: Option<u64>,
    pub(crate) capture_fps: Option<u64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecordingStartParams {
    pub(crate) track_input_events: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportRunParams {
    #[serde(rename = "outputURL")]
    pub(crate) output_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportRunCutPlanParams {
    #[serde(rename = "outputURL")]
    pub(crate) output_url: Option<String>,
    pub(crate) preset_id: Option<String>,
    pub(crate) job_id: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectOpenParams {
    pub(crate) project_path: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectSaveParams {
    pub(crate) project_path: Option<String>,
    pub(crate) auto_zoom: Option<AutoZoomParams>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AutoZoomParams {
    pub(crate) is_enabled: Option<bool>,
    pub(crate) intensity: Option<f64>,
    pub(crate) minimum_keyframe_interval: Option<f64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectRecentsParams {
    pub(crate) limit: Option<u64>,
}
