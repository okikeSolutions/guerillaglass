import type { SourcesResult } from "@guerillaglass/engine-protocol";

type SourceDisplay = SourcesResult["displays"][number];

function choosePreferredDisplay(displays: SourceDisplay[]): SourceDisplay | null {
  if (displays.length === 0) {
    return null;
  }

  const primaryDisplay = displays.find((display) => display.isPrimary);
  if (primaryDisplay) {
    return primaryDisplay;
  }

  return displays.reduce((best, candidate) => {
    if (candidate.id === best.id) {
      return best;
    }
    return candidate.id < best.id ? candidate : best;
  });
}

export function pickPreferredDisplayId(displays: SourceDisplay[]): number {
  return choosePreferredDisplay(displays)?.id ?? 0;
}

export function resolveSelectedDisplayId(
  displays: SourceDisplay[],
  selectedDisplayId: number,
): number {
  if (displays.some((display) => display.id === selectedDisplayId)) {
    return selectedDisplayId;
  }
  return pickPreferredDisplayId(displays);
}
