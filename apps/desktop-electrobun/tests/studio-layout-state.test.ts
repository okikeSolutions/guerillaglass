import { describe, expect, test } from "bun:test";
import {
  buildStudioPath,
  defaultStudioLayoutState,
  dominantLayoutPresetForRoute,
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

  test("falls back to default state for structurally invalid payloads", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: "220",
        rightPaneWidthPx: false,
        timelineHeightPx: "320",
      }),
    );
    expect(layout).toEqual(defaultStudioLayoutState);
  });

  test("uses dominant layout defaults for capture route", () => {
    expect(defaultStudioLayoutState.leftPaneWidthPx).toBe(
      dominantLayoutPresetForRoute("/capture").leftPaneWidthPx,
    );
    expect(defaultStudioLayoutState.rightPaneWidthPx).toBe(
      dominantLayoutPresetForRoute("/capture").rightPaneWidthPx,
    );
    expect(defaultStudioLayoutState.timelineHeightPx).toBe(
      dominantLayoutPresetForRoute("/capture").timelineHeightPx,
    );
    expect(defaultStudioLayoutState.presetRoutesApplied).toEqual(["/capture"]);
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
        densityMode: "ultra-compact",
      }),
    );

    expect(layout.leftPaneWidthPx).toBeGreaterThanOrEqual(studioLayoutBounds.leftPaneMinWidthPx);
    expect(layout.rightPaneWidthPx).toBeLessThanOrEqual(studioLayoutBounds.rightPaneMaxWidthPx);
    expect(layout.timelineHeightPx).toBeLessThanOrEqual(studioLayoutBounds.timelineMaxHeightPx);
    expect(layout.leftCollapsed).toBe(true);
    expect(layout.timelineCollapsed).toBe(true);
    expect(layout.lastRoute).toBe("/edit");
    expect(layout.densityMode).toBe(defaultStudioLayoutState.densityMode);
  });

  test("accepts persisted density mode", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        densityMode: "compact",
      }),
    );

    expect(layout.densityMode).toBe("compact");
  });

  test("applies dominant preset when loading legacy default layout shape", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: 260,
        rightPaneWidthPx: 340,
        leftCollapsed: false,
        rightCollapsed: false,
        timelineHeightPx: 280,
        timelineCollapsed: false,
        lastRoute: "/deliver",
      }),
    );

    expect(layout.leftPaneWidthPx).toBe(dominantLayoutPresetForRoute("/deliver").leftPaneWidthPx);
    expect(layout.rightPaneWidthPx).toBe(dominantLayoutPresetForRoute("/deliver").rightPaneWidthPx);
    expect(layout.timelineHeightPx).toBe(dominantLayoutPresetForRoute("/deliver").timelineHeightPx);
    expect(layout.leftCollapsed).toBe(dominantLayoutPresetForRoute("/deliver").leftCollapsed);
    expect(layout.presetRoutesApplied).toEqual(["/deliver"]);
  });

  test("upgrades persisted capture layouts to the latest preview-first preset", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: 420,
        rightPaneWidthPx: 420,
        leftCollapsed: false,
        rightCollapsed: false,
        timelineHeightPx: 360,
        timelineCollapsed: false,
        lastRoute: "/capture",
        presetRoutesApplied: ["/capture"],
      }),
    );

    expect(layout).toMatchObject({
      ...dominantLayoutPresetForRoute("/capture"),
      lastRoute: "/capture",
    });
    expect(layout.presetVersionByRoute["/capture"]).toBeGreaterThanOrEqual(3);
  });

  test("keeps persisted capture layouts once current preset revision is applied", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: 180,
        rightPaneWidthPx: 260,
        leftCollapsed: false,
        rightCollapsed: false,
        timelineHeightPx: 240,
        timelineCollapsed: false,
        lastRoute: "/capture",
        presetRoutesApplied: ["/capture"],
        presetVersionByRoute: { "/capture": 3 },
      }),
    );

    expect(layout.leftPaneWidthPx).toBe(180);
    expect(layout.rightPaneWidthPx).toBe(260);
    expect(layout.timelineHeightPx).toBe(240);
    expect(layout.leftCollapsed).toBe(false);
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
