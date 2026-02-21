import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioLocale } from "@guerillaglass/localization";
import type { StudioMode } from "../../model/inspectorSelectionModel";
import {
  defaultStudioLayoutState,
  dominantLayoutPresetForRoute,
  loadStudioLayoutState,
  modeForStudioRoute,
  normalizeStudioLayoutRoute,
  requiredLayoutPresetVersionForRoute,
  saveStudioLayoutState,
  studioLayoutBounds,
  type StudioDensityMode,
} from "../../model/studioLayoutModel";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function useStudioLayoutController() {
  const [layout, setLayout] = useState(() => loadStudioLayoutState());

  useEffect(() => {
    const timer = setTimeout(() => {
      saveStudioLayoutState(layout);
    }, 120);
    return () => clearTimeout(timer);
  }, [layout]);

  const activeMode = useMemo<StudioMode>(
    () => modeForStudioRoute(layout.lastRoute),
    [layout.lastRoute],
  );

  const setLeftPaneWidth = useCallback((widthPx: number) => {
    setLayout((current) => {
      const nextWidth = clamp(
        Math.round(widthPx),
        studioLayoutBounds.leftPaneMinWidthPx,
        studioLayoutBounds.leftPaneMaxWidthPx,
      );
      if (current.leftPaneWidthPx === nextWidth && !current.leftCollapsed) {
        return current;
      }
      return {
        ...current,
        leftPaneWidthPx: nextWidth,
        leftCollapsed: false,
      };
    });
  }, []);

  const setRightPaneWidth = useCallback((widthPx: number) => {
    setLayout((current) => {
      const nextWidth = clamp(
        Math.round(widthPx),
        studioLayoutBounds.rightPaneMinWidthPx,
        studioLayoutBounds.rightPaneMaxWidthPx,
      );
      if (current.rightPaneWidthPx === nextWidth && !current.rightCollapsed) {
        return current;
      }
      return {
        ...current,
        rightPaneWidthPx: nextWidth,
        rightCollapsed: false,
      };
    });
  }, []);

  const setTimelineHeight = useCallback((heightPx: number) => {
    setLayout((current) => {
      const nextHeight = clamp(
        Math.round(heightPx),
        studioLayoutBounds.timelineMinHeightPx,
        studioLayoutBounds.timelineMaxHeightPx,
      );
      if (current.timelineHeightPx === nextHeight && !current.timelineCollapsed) {
        return current;
      }
      return {
        ...current,
        timelineHeightPx: nextHeight,
        timelineCollapsed: false,
      };
    });
  }, []);

  const toggleTimelineCollapsed = useCallback(() => {
    setLayout((current) => ({
      ...current,
      timelineCollapsed: !current.timelineCollapsed,
    }));
  }, []);

  const setTimelineCollapsed = useCallback((collapsed: boolean) => {
    setLayout((current) => {
      if (current.timelineCollapsed === collapsed) {
        return current;
      }
      return {
        ...current,
        timelineCollapsed: collapsed,
      };
    });
  }, []);

  const toggleLeftPaneCollapsed = useCallback(() => {
    setLayout((current) => ({
      ...current,
      leftCollapsed: !current.leftCollapsed,
    }));
  }, []);

  const setLeftPaneCollapsed = useCallback((collapsed: boolean) => {
    setLayout((current) => {
      if (current.leftCollapsed === collapsed) {
        return current;
      }
      return {
        ...current,
        leftCollapsed: collapsed,
      };
    });
  }, []);

  const toggleRightPaneCollapsed = useCallback(() => {
    setLayout((current) => ({
      ...current,
      rightCollapsed: !current.rightCollapsed,
    }));
  }, []);

  const setRightPaneCollapsed = useCallback((collapsed: boolean) => {
    setLayout((current) => {
      if (current.rightCollapsed === collapsed) {
        return current;
      }
      return {
        ...current,
        rightCollapsed: collapsed,
      };
    });
  }, []);

  const setLastRoute = useCallback((route: string) => {
    setLayout((current) => {
      const nextRoute = normalizeStudioLayoutRoute(route);
      if (current.lastRoute === nextRoute) {
        return current;
      }

      const requiredPresetVersion = requiredLayoutPresetVersionForRoute(nextRoute);
      const appliedPresetVersion = current.presetVersionByRoute[nextRoute] ?? 0;
      const routePresetNeedsUpgrade = appliedPresetVersion < requiredPresetVersion;

      if (current.presetRoutesApplied.includes(nextRoute) && !routePresetNeedsUpgrade) {
        return {
          ...current,
          lastRoute: nextRoute,
        };
      }

      const preset = dominantLayoutPresetForRoute(nextRoute);
      return {
        ...current,
        ...preset,
        lastRoute: nextRoute,
        presetRoutesApplied: Array.from(new Set([...current.presetRoutesApplied, nextRoute])),
        presetVersionByRoute: {
          ...current.presetVersionByRoute,
          [nextRoute]: requiredPresetVersion,
        },
      };
    });
  }, []);

  const setLocale = useCallback((nextLocale: StudioLocale) => {
    setLayout((current) => ({
      ...current,
      locale: nextLocale,
    }));
  }, []);

  const setDensityMode = useCallback((nextDensityMode: StudioDensityMode) => {
    setLayout((current) => {
      if (current.densityMode === nextDensityMode) {
        return current;
      }
      return {
        ...current,
        densityMode: nextDensityMode,
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout((current) => {
      const preset = dominantLayoutPresetForRoute(current.lastRoute);
      return {
        ...defaultStudioLayoutState,
        ...preset,
        lastRoute: current.lastRoute,
        locale: current.locale,
        densityMode: current.densityMode,
        presetRoutesApplied: [current.lastRoute],
        presetVersionByRoute: {
          [current.lastRoute]: requiredLayoutPresetVersionForRoute(current.lastRoute),
        },
      };
    });
  }, []);

  return {
    activeMode,
    layout,
    resetLayout,
    setDensityMode,
    setLastRoute,
    setLeftPaneCollapsed,
    setLeftPaneWidth,
    setLocale,
    setRightPaneCollapsed,
    setRightPaneWidth,
    setTimelineCollapsed,
    setTimelineHeight,
    toggleLeftPaneCollapsed,
    toggleRightPaneCollapsed,
    toggleTimelineCollapsed,
  };
}
