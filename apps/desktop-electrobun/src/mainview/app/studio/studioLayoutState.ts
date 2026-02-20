import {
  defaultStudioLocale,
  normalizeStudioLocale,
  type StudioLocale,
} from "@guerillaglass/localization";
import { z } from "zod";
import type { StudioMode } from "./inspectorContext";

export const studioLayoutStorageKey = "gg.studio.layout.v1";

export const studioLayoutBounds = {
  leftPaneMinWidthPx: 150,
  leftPaneMaxWidthPx: 640,
  rightPaneMinWidthPx: 220,
  rightPaneMaxWidthPx: 760,
  timelineMinHeightPx: 140,
  timelineMaxHeightPx: 420,
} as const;

export const studioLayoutRoutes = ["/capture", "/edit", "/deliver"] as const;
export const studioDensityModes = ["comfortable", "compact"] as const;

export type StudioLayoutRoute = (typeof studioLayoutRoutes)[number];
export type StudioLocalizedRouteTarget = "/$locale/capture" | "/$locale/edit" | "/$locale/deliver";
export type StudioDensityMode = (typeof studioDensityModes)[number];

const localeSegmentPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;

const routeByMode: Record<StudioMode, StudioLayoutRoute> = {
  capture: "/capture",
  edit: "/edit",
  deliver: "/deliver",
};

const modeByRoute: Record<StudioLayoutRoute, StudioMode> = {
  "/capture": "capture",
  "/edit": "edit",
  "/deliver": "deliver",
};

const localizedRouteTargetByRoute: Record<StudioLayoutRoute, StudioLocalizedRouteTarget> = {
  "/capture": "/$locale/capture",
  "/edit": "/$locale/edit",
  "/deliver": "/$locale/deliver",
};

const studioLayoutStorageCandidateSchema = z
  .object({
    leftPaneWidthPx: z.number().finite().optional(),
    rightPaneWidthPx: z.number().finite().optional(),
    leftCollapsed: z.boolean().optional(),
    rightCollapsed: z.boolean().optional(),
    timelineHeightPx: z.number().finite().optional(),
    timelineCollapsed: z.boolean().optional(),
    lastRoute: z.string().optional(),
    locale: z.string().optional(),
    densityMode: z.string().optional(),
    presetRoutesApplied: z.array(z.string()).optional(),
    presetVersionByRoute: z.record(z.string(), z.number().finite()).optional(),
  })
  .passthrough();

export type StudioLayoutState = {
  leftPaneWidthPx: number;
  rightPaneWidthPx: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineHeightPx: number;
  timelineCollapsed: boolean;
  lastRoute: StudioLayoutRoute;
  locale: StudioLocale;
  densityMode: StudioDensityMode;
  presetRoutesApplied: StudioLayoutRoute[];
  presetVersionByRoute: Partial<Record<StudioLayoutRoute, number>>;
};

type StudioLayoutPreset = Pick<
  StudioLayoutState,
  | "leftPaneWidthPx"
  | "rightPaneWidthPx"
  | "leftCollapsed"
  | "rightCollapsed"
  | "timelineHeightPx"
  | "timelineCollapsed"
>;

const legacyDefaultLayoutProfile = {
  leftPaneWidthPx: 260,
  rightPaneWidthPx: 340,
  leftCollapsed: false,
  rightCollapsed: false,
  timelineHeightPx: 280,
  timelineCollapsed: false,
} as const;

const dominantLayoutPresetsByRoute: Record<StudioLayoutRoute, StudioLayoutPreset> = {
  "/capture": {
    leftPaneWidthPx: 180,
    rightPaneWidthPx: 220,
    leftCollapsed: true,
    rightCollapsed: false,
    timelineHeightPx: 160,
    timelineCollapsed: false,
  },
  "/edit": {
    leftPaneWidthPx: 200,
    rightPaneWidthPx: 260,
    leftCollapsed: true,
    rightCollapsed: false,
    timelineHeightPx: 360,
    timelineCollapsed: false,
  },
  "/deliver": {
    leftPaneWidthPx: 220,
    rightPaneWidthPx: 280,
    leftCollapsed: true,
    rightCollapsed: false,
    timelineHeightPx: 340,
    timelineCollapsed: false,
  },
};

const studioLayoutPresetVersionByRoute: Record<StudioLayoutRoute, number> = {
  "/capture": 3,
  "/edit": 0,
  "/deliver": 0,
};

export function dominantLayoutPresetForRoute(route: StudioLayoutRoute): StudioLayoutPreset {
  return dominantLayoutPresetsByRoute[route];
}

export function requiredLayoutPresetVersionForRoute(route: StudioLayoutRoute): number {
  return studioLayoutPresetVersionByRoute[route];
}

export const defaultStudioLayoutState: StudioLayoutState = {
  ...dominantLayoutPresetsByRoute["/capture"],
  lastRoute: "/capture",
  locale: defaultStudioLocale,
  densityMode: "comfortable",
  presetRoutesApplied: ["/capture"],
  presetVersionByRoute: {
    "/capture": studioLayoutPresetVersionByRoute["/capture"],
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }
  return value;
}

function asStudioDensityMode(value: unknown): StudioDensityMode | null {
  if (typeof value !== "string") {
    return null;
  }
  if (studioDensityModes.includes(value as StudioDensityMode)) {
    return value as StudioDensityMode;
  }
  return null;
}

function asPresetRoutesApplied(value: unknown): StudioLayoutRoute[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const routes = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeStudioLayoutRoute(item));
  return Array.from(new Set(routes));
}

function asPresetVersionByRoute(value: unknown): Partial<Record<StudioLayoutRoute, number>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value);
  const next: Partial<Record<StudioLayoutRoute, number>> = {};
  for (const [route, version] of entries) {
    if (typeof version !== "number" || Number.isNaN(version) || !Number.isFinite(version)) {
      continue;
    }
    const normalizedRoute = normalizeStudioLayoutRoute(route);
    next[normalizedRoute] = Math.max(0, Math.round(version));
  }
  return next;
}

export function routeForStudioMode(mode: StudioMode): StudioLayoutRoute {
  return routeByMode[mode];
}

export function modeForStudioRoute(route: StudioLayoutRoute): StudioMode {
  return modeByRoute[route];
}

export function localizedRouteTargetFor(route: StudioLayoutRoute): StudioLocalizedRouteTarget {
  return localizedRouteTargetByRoute[route];
}

export function buildStudioPath(locale: StudioLocale, route: StudioLayoutRoute): string {
  return `/${locale}${route}`;
}

function stripLocalePrefix(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 2 && localeSegmentPattern.test(segments[0] ?? "")) {
    return `/${segments.slice(1).join("/")}`;
  }
  return normalized;
}

export function normalizeStudioLayoutRoute(route: string | null | undefined): StudioLayoutRoute {
  if (!route) {
    return defaultStudioLayoutState.lastRoute;
  }

  const normalizedRoute = stripLocalePrefix(route);
  if (normalizedRoute.startsWith("/capture")) {
    return "/capture";
  }
  if (normalizedRoute.startsWith("/edit")) {
    return "/edit";
  }
  if (normalizedRoute.startsWith("/deliver")) {
    return "/deliver";
  }
  return defaultStudioLayoutState.lastRoute;
}

export function resolveStudioLocation(pathname: string | null | undefined): {
  locale: StudioLocale;
  route: StudioLayoutRoute;
} {
  if (!pathname) {
    return {
      locale: defaultStudioLayoutState.locale,
      route: defaultStudioLayoutState.lastRoute,
    };
  }

  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalized.split("/").filter(Boolean);
  const locale = segments.length >= 1 ? normalizeStudioLocale(segments[0]) : defaultStudioLocale;

  return {
    locale,
    route: normalizeStudioLayoutRoute(normalized),
  };
}

export function sanitizeStudioLayoutState(
  candidate: Partial<StudioLayoutState> | null | undefined,
): StudioLayoutState {
  const leftPaneWidthPx =
    asFiniteNumber(candidate?.leftPaneWidthPx) ?? defaultStudioLayoutState.leftPaneWidthPx;
  const rightPaneWidthPx =
    asFiniteNumber(candidate?.rightPaneWidthPx) ?? defaultStudioLayoutState.rightPaneWidthPx;
  const timelineHeightPx =
    asFiniteNumber(candidate?.timelineHeightPx) ?? defaultStudioLayoutState.timelineHeightPx;

  const lastRoute = normalizeStudioLayoutRoute(candidate?.lastRoute);
  const presetRoutesApplied = asPresetRoutesApplied(candidate?.presetRoutesApplied) ?? [];
  const presetVersionByRoute = asPresetVersionByRoute(candidate?.presetVersionByRoute) ?? {};
  const currentPresetVersion = presetVersionByRoute[lastRoute] ?? 0;
  const requiredPresetVersion = studioLayoutPresetVersionByRoute[lastRoute];
  const routePresetNeedsUpgrade = currentPresetVersion < requiredPresetVersion;

  const hasLegacyShape =
    candidate?.presetRoutesApplied == null &&
    leftPaneWidthPx === legacyDefaultLayoutProfile.leftPaneWidthPx &&
    rightPaneWidthPx === legacyDefaultLayoutProfile.rightPaneWidthPx &&
    timelineHeightPx === legacyDefaultLayoutProfile.timelineHeightPx &&
    candidate?.leftCollapsed === legacyDefaultLayoutProfile.leftCollapsed &&
    candidate?.rightCollapsed === legacyDefaultLayoutProfile.rightCollapsed &&
    candidate?.timelineCollapsed === legacyDefaultLayoutProfile.timelineCollapsed;

  const effectivePreset =
    hasLegacyShape || routePresetNeedsUpgrade
      ? dominantLayoutPresetForRoute(lastRoute)
      : {
          leftPaneWidthPx: leftPaneWidthPx,
          rightPaneWidthPx: rightPaneWidthPx,
          leftCollapsed:
            asBoolean(candidate?.leftCollapsed) ?? defaultStudioLayoutState.leftCollapsed,
          rightCollapsed:
            asBoolean(candidate?.rightCollapsed) ?? defaultStudioLayoutState.rightCollapsed,
          timelineHeightPx: timelineHeightPx,
          timelineCollapsed:
            asBoolean(candidate?.timelineCollapsed) ?? defaultStudioLayoutState.timelineCollapsed,
        };

  return {
    leftPaneWidthPx: clamp(
      Math.round(effectivePreset.leftPaneWidthPx),
      studioLayoutBounds.leftPaneMinWidthPx,
      studioLayoutBounds.leftPaneMaxWidthPx,
    ),
    rightPaneWidthPx: clamp(
      Math.round(effectivePreset.rightPaneWidthPx),
      studioLayoutBounds.rightPaneMinWidthPx,
      studioLayoutBounds.rightPaneMaxWidthPx,
    ),
    leftCollapsed: effectivePreset.leftCollapsed,
    rightCollapsed: effectivePreset.rightCollapsed,
    timelineHeightPx: clamp(
      Math.round(effectivePreset.timelineHeightPx),
      studioLayoutBounds.timelineMinHeightPx,
      studioLayoutBounds.timelineMaxHeightPx,
    ),
    timelineCollapsed: effectivePreset.timelineCollapsed,
    lastRoute,
    locale: normalizeStudioLocale(candidate?.locale),
    densityMode:
      asStudioDensityMode(candidate?.densityMode) ?? defaultStudioLayoutState.densityMode,
    presetRoutesApplied:
      hasLegacyShape || routePresetNeedsUpgrade
        ? Array.from(new Set([...presetRoutesApplied, lastRoute]))
        : presetRoutesApplied,
    presetVersionByRoute:
      hasLegacyShape || routePresetNeedsUpgrade
        ? {
            ...presetVersionByRoute,
            [lastRoute]: requiredPresetVersion,
          }
        : presetVersionByRoute,
  };
}

export function parseStudioLayoutState(raw: string | null | undefined): StudioLayoutState {
  if (!raw) {
    return defaultStudioLayoutState;
  }
  try {
    const parsedJson: unknown = JSON.parse(raw);
    const parsedCandidate = studioLayoutStorageCandidateSchema.safeParse(parsedJson);
    if (!parsedCandidate.success) {
      return defaultStudioLayoutState;
    }
    return sanitizeStudioLayoutState(parsedCandidate.data as Partial<StudioLayoutState>);
  } catch {
    return defaultStudioLayoutState;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStudioLayoutState(): StudioLayoutState {
  const storage = getStorage();
  if (!storage) {
    return defaultStudioLayoutState;
  }
  const raw = storage.getItem(studioLayoutStorageKey);
  return parseStudioLayoutState(raw);
}

export function saveStudioLayoutState(layout: StudioLayoutState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const normalized = sanitizeStudioLayoutState(layout);
  storage.setItem(studioLayoutStorageKey, JSON.stringify(normalized));
}

export function getInitialStudioRoute(): StudioLayoutRoute {
  return loadStudioLayoutState().lastRoute;
}

export function getInitialStudioLocale(): StudioLocale {
  return loadStudioLayoutState().locale;
}

export function getInitialStudioPath(): string {
  const layout = loadStudioLayoutState();
  return buildStudioPath(layout.locale, layout.lastRoute);
}
