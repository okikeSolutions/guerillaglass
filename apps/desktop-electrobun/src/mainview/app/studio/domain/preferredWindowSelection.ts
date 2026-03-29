import type { SourcesResult } from "@guerillaglass/engine-protocol";

type SourceWindow = SourcesResult["windows"][number];

const minimumPreferredWindowWidth = 120;
const minimumPreferredWindowHeight = 80;

function windowArea(windowItem: SourceWindow): number {
  return windowItem.width * windowItem.height;
}

function hasTitle(windowItem: SourceWindow): boolean {
  return windowItem.title.trim().length > 0;
}

function chooseLargestWindow(windows: SourceWindow[]): SourceWindow | null {
  if (windows.length === 0) {
    return null;
  }

  const [firstWindow, ...remainingWindows] = windows;
  return remainingWindows.reduce((best, candidate) => {
    const areaDelta = windowArea(candidate) - windowArea(best);
    if (areaDelta !== 0) {
      return areaDelta > 0 ? candidate : best;
    }

    const titleDelta = Number(hasTitle(candidate)) - Number(hasTitle(best));
    if (titleDelta !== 0) {
      return titleDelta > 0 ? candidate : best;
    }

    return candidate.id < best.id ? candidate : best;
  }, firstWindow);
}

export function pickPreferredWindowId(windows: SourceWindow[]): number {
  if (windows.length === 0) {
    return 0;
  }

  const sizableWindows = windows.filter(
    (windowItem) =>
      windowItem.width >= minimumPreferredWindowWidth &&
      windowItem.height >= minimumPreferredWindowHeight,
  );

  const preferredPool = sizableWindows.length > 0 ? sizableWindows : windows;
  const preferredWindow = chooseLargestWindow(preferredPool);
  return preferredWindow?.id ?? 0;
}

export function resolveSelectedWindowId(windows: SourceWindow[], selectedWindowId: number): number {
  if (windows.some((windowItem) => windowItem.id === selectedWindowId)) {
    return selectedWindowId;
  }
  return pickPreferredWindowId(windows);
}
