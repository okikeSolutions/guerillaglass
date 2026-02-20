import { describe, expect, test } from "bun:test";
import {
  buildStudioPath,
  defaultStudioLayoutState,
  getInitialStudioPath,
  localizedRouteTargetFor,
  normalizeStudioLayoutRoute,
  parseStudioLayoutState,
  resolveStudioLocation,
  routeForStudioMode,
  studioLayoutBounds,
} from "../src/mainview/app/studio/studioLayoutState";

describe("studio layout state", () => {
  test("normalizes known route prefixes", () => {
    expect(normalizeStudioLayoutRoute("/capture")).toBe("/capture");
    expect(normalizeStudioLayoutRoute("/en-US/capture")).toBe("/capture");
    expect(normalizeStudioLayoutRoute("/de-DE/edit")).toBe("/edit");
    expect(normalizeStudioLayoutRoute("/en/capture")).toBe("/capture");
    expect(normalizeStudioLayoutRoute("/de/edit")).toBe("/edit");
    expect(normalizeStudioLayoutRoute("/edit/details")).toBe("/edit");
    expect(normalizeStudioLayoutRoute("/deliver/final")).toBe("/deliver");
  });

  test("falls back to default route for unknown values", () => {
    expect(normalizeStudioLayoutRoute("/unknown")).toBe(defaultStudioLayoutState.lastRoute);
    expect(normalizeStudioLayoutRoute("")).toBe(defaultStudioLayoutState.lastRoute);
  });

  test("parses malformed JSON with default state", () => {
    expect(parseStudioLayoutState("{not-json")).toEqual(defaultStudioLayoutState);
  });

  test("sanitizes out-of-range values", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: 10,
        rightPaneWidthPx: 3000,
        leftCollapsed: true,
        rightCollapsed: false,
        timelineHeightPx: 999,
        timelineCollapsed: true,
        lastRoute: "/edit/deep-link",
      }),
    );

    expect(layout.leftPaneWidthPx).toBeGreaterThanOrEqual(studioLayoutBounds.leftPaneMinWidthPx);
    expect(layout.rightPaneWidthPx).toBeLessThanOrEqual(studioLayoutBounds.rightPaneMaxWidthPx);
    expect(layout.timelineHeightPx).toBeLessThanOrEqual(studioLayoutBounds.timelineMaxHeightPx);
    expect(layout.leftCollapsed).toBe(true);
    expect(layout.timelineCollapsed).toBe(true);
    expect(layout.lastRoute).toBe("/edit");
  });

  test("resolves locale and route from pathname", () => {
    expect(resolveStudioLocation("/de-DE/deliver")).toEqual({
      locale: "de-DE",
      route: "/deliver",
    });
    expect(resolveStudioLocation("/de/deliver")).toEqual({
      locale: "de-DE",
      route: "/deliver",
    });
    expect(resolveStudioLocation("/fr-FR/capture")).toEqual({
      locale: "en-US",
      route: "/capture",
    });
  });

  test("builds locale routes for all studio modes", () => {
    expect(buildStudioPath("de-DE", routeForStudioMode("capture"))).toBe("/de-DE/capture");
    expect(buildStudioPath("de-DE", routeForStudioMode("edit"))).toBe("/de-DE/edit");
    expect(buildStudioPath("de-DE", routeForStudioMode("deliver"))).toBe("/de-DE/deliver");
  });

  test("maps canonical route targets for router redirects", () => {
    expect(localizedRouteTargetFor("/capture")).toBe("/$locale/capture");
    expect(localizedRouteTargetFor("/edit")).toBe("/$locale/edit");
    expect(localizedRouteTargetFor("/deliver")).toBe("/$locale/deliver");
  });

  test("builds initial path from persisted layout", () => {
    expect(getInitialStudioPath()).toMatch(/^\/(en-US|de-DE)\/(capture|edit|deliver)$/);
  });
});
