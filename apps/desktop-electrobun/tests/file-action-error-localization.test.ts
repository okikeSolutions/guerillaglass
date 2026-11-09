import { describe, expect, test } from "vitest";
import { PathPickerError, BridgeInvocationError } from "@shared/errors/desktopErrors";
import {
  serializeBridgeError,
  deserializeBridgeError,
} from "@shared/errors/desktopErrorSerialization";
import { createWindowBridgeBindings } from "@shared/bridge/desktopBridgeBindings";
import { getStudioMessages } from "@shared/localization";
import { mapStudioActionErrorMessage } from "@studio/hooks/core/useStudioController";

const failures = [
  ["PATH_PICKER_OPEN_DIALOG_FAILED", "pathPickerOpenFailed"],
  ["PATH_PICKER_SAVE_DIALOG_FAILED", "pathPickerSaveFailed"],
  ["PATH_PICKER_REQUEST_FAILED", "pathPickerRequestFailed"],
  ["PATH_PICKER_OVERWRITE_FAILED", "pathPickerOverwriteFailed"],
  ["EXPORT_RESULT_UNAVAILABLE", "exportResultUnavailable"],
  ["EXPORT_RESULT_OPEN_FAILED", "exportResultOpenFailed"],
  ["EXPORT_RESULT_REVEAL_FAILED", "exportResultRevealFailed"],
] as const;

// Preserve the actual JSON transport semantics, including omitted undefined fields.
function throughJsonWire(
  payload: ReturnType<typeof serializeBridgeError>,
): ReturnType<typeof serializeBridgeError> {
  const encoded = JSON.stringify(payload);
  return JSON.parse(encoded);
}

describe("native file action localization across bridge transport", () => {
  test.each(failures)(
    "localizes %s in both locales after real bridge decoding",
    async (code, notice) => {
      const diagnostic = "Untranslated native diagnostic /private/secret-project/export.mp4";
      const hostError = new PathPickerError({
        code,
        description: diagnostic,
        cause: new Error("OS detail"),
      });
      const wireError = throughJsonWire(serializeBridgeError(hostError));
      const bindings = createWindowBridgeBindings(
        async () => ({ ok: false, error: wireError }),
        () => {},
        () => {},
      );
      const openResult = bindings.ggOpenExportResult;
      if (!openResult) {
        throw new Error("Export result bridge was not installed");
      }
      const transported = await openResult("open").catch((error: unknown) => error);
      for (const locale of ["en-US", "de-DE"] as const) {
        const ui = getStudioMessages(locale);
        const message = mapStudioActionErrorMessage(ui, transported);
        expect(message).toBe(ui.notices[notice]);
        expect(message).not.toContain(diagnostic);
        expect(message).not.toContain("/private/");
        // Raw tagged/serialized forms need no surviving Error prototype either.
        expect(
          mapStudioActionErrorMessage(ui, {
            _tag: "PathPickerError",
            code,
            description: diagnostic,
          }),
        ).toBe(message);
        expect(mapStudioActionErrorMessage(ui, wireError)).toBe(message);
      }
      expect(getStudioMessages("de-DE").notices[notice]).not.toBe(
        getStudioMessages("en-US").notices[notice],
      );
    },
  );

  test("a nested invocation failure preserves its localized native reason", () => {
    const host = new BridgeInvocationError({
      bridge: "ggOpenExportResult",
      cause: new PathPickerError({
        code: "EXPORT_RESULT_REVEAL_FAILED",
        description: "OS diagnostic",
      }),
    });
    const wire = throughJsonWire(serializeBridgeError(host));
    const ui = getStudioMessages("de-DE");
    expect(mapStudioActionErrorMessage(ui, deserializeBridgeError(wire))).toBe(
      ui.notices.exportResultRevealFailed,
    );
    expect(mapStudioActionErrorMessage(ui, wire)).toBe(ui.notices.exportResultRevealFailed);
  });

  test("unknown native codes use localized generic recovery instead of diagnostics", () => {
    const ui = getStudioMessages("de-DE");
    expect(
      mapStudioActionErrorMessage(ui, {
        _tag: "PathPickerError",
        code: "FUTURE_NATIVE_CODE",
        description: "English host detail",
      }),
    ).toBe(ui.notices.pathPickerRequestFailed);
  });
});
