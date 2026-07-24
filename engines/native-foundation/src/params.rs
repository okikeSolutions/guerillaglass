use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundFramingParams {
    pub(crate) version: f64,
    pub(crate) enabled: bool,
    pub(crate) background_color: String,
    pub(crate) padding_fraction: f64,
    pub(crate) corner_radius_fraction: f64,
    pub(crate) shadow_strength: f64,
}

impl Default for BackgroundFramingParams {
    fn default() -> Self {
        Self {
            version: 1.0,
            enabled: false,
            background_color: "#18181B".to_string(),
            padding_fraction: 0.06,
            corner_radius_fraction: 0.025,
            shadow_strength: 0.35,
        }
    }
}

impl BackgroundFramingParams {
    pub(crate) fn validated(mut self) -> Result<Self, &'static str> {
        if self.version != 1.0 {
            return Err("backgroundFraming.version must be 1");
        }
        let color = self.background_color.as_bytes();
        if color.len() != 7
            || color.first() != Some(&b'#')
            || !color[1..].iter().all(u8::is_ascii_hexdigit)
        {
            return Err("backgroundFraming.backgroundColor must be #RRGGBB");
        }
        if !valid_fraction(self.padding_fraction, 0.25) {
            return Err("backgroundFraming.paddingFraction must be finite and between 0 and 0.25");
        }
        if !valid_fraction(self.corner_radius_fraction, 0.10) {
            return Err(
                "backgroundFraming.cornerRadiusFraction must be finite and between 0 and 0.10",
            );
        }
        if !valid_fraction(self.shadow_strength, 1.0) {
            return Err("backgroundFraming.shadowStrength must be finite and between 0 and 1");
        }
        self.background_color.make_ascii_uppercase();
        Ok(self)
    }
}

fn valid_fraction(value: f64, maximum: f64) -> bool {
    value.is_finite() && (0.0..=maximum).contains(&value)
}

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
    pub(crate) background_framing: Option<BackgroundFramingParams>,
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
    pub(crate) background_framing: Option<BackgroundFramingParams>,
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
