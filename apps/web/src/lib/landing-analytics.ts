export type LandingAnalyticsPayload = Record<string, string | number | boolean | null>;

const landingEventName = "guerillaglass:landing-analytics";

export function trackLandingEvent(name: string, payload: LandingAnalyticsPayload = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent(landingEventName, { detail }));
}
