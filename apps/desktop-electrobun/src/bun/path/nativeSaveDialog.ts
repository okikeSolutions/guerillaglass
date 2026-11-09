import { Effect, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { PathPickerError } from "../../shared/errors/desktopErrors";

// All user-controlled values are argv, never AppleScript or shell source.
const saveScript = `on run argv
  try
    set selectedFile to choose file name with prompt (item 1 of argv) default name (item 2 of argv) default location (POSIX file (item 3 of argv))
    return POSIX path of selectedFile
  on error number -128
    return ""
  end try
end run`;

export const nativeSaveDialog = Effect.fn("NativeSaveDialog.chooseFile")(function* (options: {
  prompt: string;
  defaultName: string;
  startingFolder: string;
}) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(
        "/usr/bin/osascript",
        ["-e", saveScript, "--", options.prompt, options.defaultName, options.startingFolder],
        { stdin: "ignore", stdout: "pipe", stderr: "ignore" },
      );
      const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
      const code = yield* handle.exitCode;
      if (code !== 0) {
        return yield* new PathPickerError({
          code: "PATH_PICKER_SAVE_DIALOG_FAILED",
          description: "Native Save dialog failed.",
        });
      }
      // osascript appends one line ending; preserve whitespace in selected names.
      const selected = output.replace(/\r?\n$/, "");
      return selected.length > 0 ? selected : null;
    }),
  ).pipe(
    Effect.mapError((cause) =>
      cause instanceof PathPickerError
        ? cause
        : new PathPickerError({
            code: "PATH_PICKER_SAVE_DIALOG_FAILED",
            description: "Native Save dialog failed.",
            cause,
          }),
    ),
  );
});
