import {
  defaultStudioLocale,
  normalizeStudioLocale,
  type StudioLocale,
} from "@guerillaglass/localization";
import type { StudioMode } from "./inspectorContext";

export const studioLayoutStorageKey = "gg.studio.layout.v1";

export const studioLayoutBounds = {
  leftPaneMinWidthPx: 180,
  leftPaneMaxWidthPx: 520,
  rightPaneMinWidthPx: 260,
  rightPaneMaxWidthPx: 620,
  timelineMinHeightPx: 180,
  timelineMaxHeightPx: 560,
} as const;

export const studioLayoutRoutes = ["/capture", "/edit", "/deliver"] as const;

export type StudioLayoutRoute = (typeof studioLayoutRoutes)[number];
export type StudioLocalizedRouteTarget = "/$locale/capture" | "/$locale/edit" | "/$locale/deliver";

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

export type StudioLayoutState = {
  leftPaneWidthPx: number;
  rightPaneWidthPx: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineHeightPx: number;
  lastRoute: StudioLayoutRoute;
  locale: StudioLocale;
};

export const defaultStudioLayoutState: StudioLayoutState = {
  leftPaneWidthPx: 260,
  rightPaneWidthPx: 340,
  leftCollapsed: false,
  rightCollapsed: false,
  timelineHeightPx: 280,
  lastRoute: "/capture",
  locale: defaultStudioLocale,
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

  return {
    leftPaneWidthPx: clamp(
      Math.round(leftPaneWidthPx),
      studioLayoutBounds.leftPaneMinWidthPx,
      studioLayoutBounds.leftPaneMaxWidthPx,
    ),
    rightPaneWidthPx: clamp(
      Math.round(rightPaneWidthPx),
      studioLayoutBounds.rightPaneMinWidthPx,
      studioLayoutBounds.rightPaneMaxWidthPx,
    ),
    leftCollapsed: asBoolean(candidate?.leftCollapsed) ?? defaultStudioLayoutState.leftCollapsed,
    rightCollapsed: asBoolean(candidate?.rightCollapsed) ?? defaultStudioLayoutState.rightCollapsed,
    timelineHeightPx: clamp(
      Math.round(timelineHeightPx),
      studioLayoutBounds.timelineMinHeightPx,
      studioLayoutBounds.timelineMaxHeightPx,
    ),
    lastRoute: normalizeStudioLayoutRoute(candidate?.lastRoute),
    locale: normalizeStudioLocale(candidate?.locale),
  };
}

export function parseStudioLayoutState(raw: string | null | undefined): StudioLayoutState {
  if (!raw) {
    return defaultStudioLayoutState;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StudioLayoutState>;
    return sanitizeStudioLayoutState(parsed);
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
