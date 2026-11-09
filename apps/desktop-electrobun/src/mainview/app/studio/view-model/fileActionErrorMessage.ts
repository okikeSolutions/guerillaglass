import { Option, Schema } from "effect";
import { PathPickerError } from "@shared/errors/desktopErrors";
import type { StudioMessages } from "@shared/localization";

/** Host diagnostics never become UI copy. Support both rehydrated tagged errors
 * and serialized payloads so localization does not depend on Error prototypes.
 */
export function fileActionErrorMessage(ui: StudioMessages, error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    const tag = "_tag" in current ? current._tag : "tag" in current ? current.tag : undefined;
    if (tag === "PathPickerError") {
      const data = "data" in current ? current.data : current;
      const code =
        typeof data === "object" && data !== null && "code" in data ? data.code : undefined;
      const knownCode = Option.getOrElse(
        Schema.decodeUnknownOption(PathPickerError.fields.code)(code),
        () => "PATH_PICKER_REQUEST_FAILED" as const,
      );
      const messages: Record<PathPickerError["code"], string> = {
        PATH_PICKER_OPEN_DIALOG_FAILED: ui.notices.pathPickerOpenFailed,
        PATH_PICKER_SAVE_DIALOG_FAILED: ui.notices.pathPickerSaveFailed,
        PATH_PICKER_REQUEST_FAILED: ui.notices.pathPickerRequestFailed,
        PATH_PICKER_OVERWRITE_FAILED: ui.notices.pathPickerOverwriteFailed,
        EXPORT_RESULT_UNAVAILABLE: ui.notices.exportResultUnavailable,
        EXPORT_RESULT_OPEN_FAILED: ui.notices.exportResultOpenFailed,
        EXPORT_RESULT_REVEAL_FAILED: ui.notices.exportResultRevealFailed,
      };
      return messages[knownCode];
    }
    if (tag !== "BridgeInvocationError" || !("cause" in current)) {
      return undefined;
    }
    current = current.cause;
  }
  return undefined;
}
