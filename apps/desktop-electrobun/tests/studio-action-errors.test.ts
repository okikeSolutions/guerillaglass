import { describe, expect, test } from "vitest";
import { getStudioMessages } from "@shared/localization";
import { EngineResponseError } from "@guerillaglass/engine-client/errors";
import { mapStudioActionErrorMessage } from "@studio/hooks/core/useStudioController";

describe("studio action error notices", () => {
  test("maps unstable recording start runtime errors to the recovery notice", () => {
    const ui = getStudioMessages("en-US");
    const error = new EngineResponseError({
      code: "runtime_error",
      description: "Capture did not stabilize quickly enough for 30 fps recording.",
    });

    expect(mapStudioActionErrorMessage(ui, error)).toBe(ui.notices.recordingStartNotReady);
  });

  test("preserves unrelated engine response messages", () => {
    const ui = getStudioMessages("en-US");
    const error = new EngineResponseError({
      code: "runtime_error",
      description: "Something else failed.",
    });

    expect(mapStudioActionErrorMessage(ui, error)).toBe("runtime_error: Something else failed.");
  });
});

test("localizes project ownership failures in both supported locales", () => {
  for (const locale of ["en-US", "de-DE"] as const) {
    const ui = getStudioMessages(locale);
    expect(
      mapStudioActionErrorMessage(
        ui,
        new EngineResponseError({
          code: "invalid_request",
          description: "project_busy: another engine owns this project",
        }),
      ),
    ).toBe(ui.notices.projectBusy);
    expect(
      mapStudioActionErrorMessage(
        ui,
        new EngineResponseError({
          code: "invalid_request",
          description: "project_unsafe_path: unsafe directory",
        }),
      ),
    ).toBe(ui.notices.projectUnsafePath);
  }
});
