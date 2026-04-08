import { describe, expect, test } from "bun:test";
import { getStudioMessages } from "@guerillaglass/localization";
import { EngineResponseError } from "@shared/errors";
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
