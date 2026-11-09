import { describe, expect, test } from "vitest";
import {
  buildStudioPath,
  defaultStudioLayoutState,
  dominantLayoutPresetForRoute,
  getInitialStudioPath,
  localizedRouteTargetFor,
  normalizeStudioLayoutRoute,
  parseStudioLayoutState,
  rebalanceStudioHorizontalPanesForViewport,
  requiredLayoutPresetVersionForRoute,
  studioCenterPaneMinWidthPx,
  resolveStudioCenterPaneMinWidthForViewport,
  resolveStudioLocation,
  routeForStudioMode,
  studioLayoutBounds,
} from "@studio/contracts/studioLayoutModel";

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
        presetVersionByRoute: { "/edit": requiredLayoutPresetVersionForRoute("/edit") },
        densityMode: "ultra-compact",
      }),
    );

    expect(layout.leftPaneWidthPx).toBe(studioLayoutBounds.leftPaneMinWidthPx);
    expect(layout.rightPaneWidthPx).toBe(studioLayoutBounds.rightPaneMaxWidthPx);
    expect(layout.timelineHeightPx).toBe(studioLayoutBounds.timelineMaxHeightPx);
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

  test("upgrades old capture layouts to expose essential setup at readable pane widths", () => {
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
    expect(layout.presetVersionByRoute["/capture"]).toBe(
      requiredLayoutPresetVersionForRoute("/capture"),
    );
    expect(layout.leftCollapsed).toBe(false);
    expect(layout.leftPaneWidthPx).toBeGreaterThanOrEqual(studioLayoutBounds.leftPaneMinWidthPx);
    expect(layout.rightPaneWidthPx).toBeGreaterThanOrEqual(studioLayoutBounds.rightPaneMinWidthPx);
  });

  test("keeps readable custom capture layouts once current preset revision is applied", () => {
    const layout = parseStudioLayoutState(
      JSON.stringify({
        leftPaneWidthPx: 320,
        rightPaneWidthPx: 360,
        leftCollapsed: true,
        rightCollapsed: false,
        timelineHeightPx: 300,
        timelineCollapsed: false,
        lastRoute: "/capture",
        presetRoutesApplied: ["/capture"],
        presetVersionByRoute: { "/capture": requiredLayoutPresetVersionForRoute("/capture") },
      }),
    );
    expect(layout.leftPaneWidthPx).toBe(320);
    expect(layout.rightPaneWidthPx).toBe(360);
    expect(layout.timelineHeightPx).toBe(300);
    expect(layout.leftCollapsed).toBe(true);
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

  test("rebalances oversized open side panes to preserve center pane startup width", () => {
    const viewportWidthPx = 1200;
    const rebalanced = rebalanceStudioHorizontalPanesForViewport(
      {
        leftPaneWidthPx: studioLayoutBounds.leftPaneMaxWidthPx,
        rightPaneWidthPx: studioLayoutBounds.rightPaneMaxWidthPx,
        leftCollapsed: false,
        rightCollapsed: false,
      },
      viewportWidthPx,
    );

    const sideTotal = rebalanced.leftPaneWidthPx + rebalanced.rightPaneWidthPx;
    const maxSideTotal =
      studioLayoutBounds.leftPaneMinWidthPx + studioLayoutBounds.rightPaneMinWidthPx;
    expect(sideTotal).toBeLessThanOrEqual(maxSideTotal);
    // At this viewport 70% would leave less than the readable side-pane
    // minimums. Allocate the largest feasible center instead of clipping them.
    expect(sideTotal).toBe(maxSideTotal);
    expect(viewportWidthPx - sideTotal - 2).toBe(678);
    expect(viewportWidthPx - sideTotal - 2).toBeGreaterThanOrEqual(studioCenterPaneMinWidthPx);
    expect(rebalanced.leftPaneWidthPx).toBeGreaterThanOrEqual(
      studioLayoutBounds.leftPaneMinWidthPx,
    );
    expect(rebalanced.rightPaneWidthPx).toBeGreaterThanOrEqual(
      studioLayoutBounds.rightPaneMinWidthPx,
    );
  });

  test("does not change readable custom side widths when the center has enough room", () => {
    const rebalanced = rebalanceStudioHorizontalPanesForViewport(
      {
        leftPaneWidthPx: 260,
        rightPaneWidthPx: 300,
        leftCollapsed: false,
        rightCollapsed: false,
      },
      1920,
    );
    expect(rebalanced).toEqual({ leftPaneWidthPx: 260, rightPaneWidthPx: 300 });
    expect(
      1920 - rebalanced.leftPaneWidthPx - rebalanced.rightPaneWidthPx - 2,
    ).toBeGreaterThanOrEqual(Math.round(1920 * 0.7));
  });

  test("resolves the requested center ratio when wide viewports can fit readable side panes", () => {
    expect(resolveStudioCenterPaneMinWidthForViewport(1920)).toBe(Math.round(1920 * 0.7));
  });

  test("caps center width at the room left by readable side panes", () => {
    expect(resolveStudioCenterPaneMinWidthForViewport(1600)).toBe(1078);
    expect(
      1078 + studioLayoutBounds.leftPaneMinWidthPx + studioLayoutBounds.rightPaneMinWidthPx + 2,
    ).toBe(1600);
  });

  test("scales center pane minimum width down on narrow viewports", () => {
    const viewportWidthPx = 900;
    const expected =
      viewportWidthPx -
      studioLayoutBounds.leftPaneMinWidthPx -
      studioLayoutBounds.rightPaneMinWidthPx -
      2;
    expect(resolveStudioCenterPaneMinWidthForViewport(viewportWidthPx)).toBe(expected);
  });
});
