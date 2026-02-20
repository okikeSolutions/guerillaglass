export type StudioSemanticState =
  | "neutral"
  | "record"
  | "error"
  | "live"
  | "selected"
  | "selectedAlt";

const toneClassByState: Record<StudioSemanticState, string> = {
  neutral: "gg-tone-neutral",
  record: "gg-tone-danger",
  error: "gg-tone-danger",
  live: "gg-tone-success",
  selected: "gg-tone-selected",
  selectedAlt: "gg-tone-selected-alt",
};

export function studioToneClass(state: StudioSemanticState): string {
  return toneClassByState[state];
}

export function studioIconToneClass(state: StudioSemanticState): string {
  return `gg-icon-tone ${studioToneClass(state)}`;
}

export function studioBadgeToneClass(state: StudioSemanticState): string {
  return `gg-badge-tone ${studioToneClass(state)}`;
}

export function studioButtonToneClass(state: StudioSemanticState): string {
  return `gg-button-tone ${studioToneClass(state)}`;
}

export function studioToggleToneClass(state: StudioSemanticState): string {
  return `gg-toggle-tone ${studioToneClass(state)}`;
}

export function studioHealthTone(health: "good" | "warning" | "critical"): StudioSemanticState {
  switch (health) {
    case "good":
      return "live";
    case "warning":
      return "selectedAlt";
    case "critical":
      return "error";
  }
}
