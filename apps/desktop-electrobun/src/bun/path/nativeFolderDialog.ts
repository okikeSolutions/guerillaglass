import { Effect, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { PathPickerError } from "../../shared/errors/desktopErrors";

// Prompt and location remain argv, never executable AppleScript or shell source.
const folderScript = `on run argv
  try
    set selectedFolder to choose folder with prompt (item 1 of argv) default location (POSIX file (item 2 of argv))
    return POSIX path of selectedFolder
  on error number -128
    return ""
  end try
end run`;

export const nativeFolderDialog = Effect.fn("NativeFolderDialog.chooseFolder")(function* (options: {
  prompt: string;
  startingFolder: string;
}) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(
        "/usr/bin/osascript",
        ["-e", folderScript, "--", options.prompt, options.startingFolder],
        { stdin: "ignore", stdout: "pipe", stderr: "ignore" },
      );
      const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
      const code = yield* handle.exitCode;
      if (code !== 0) {
        return yield* new PathPickerError({
          code: "PATH_PICKER_OPEN_DIALOG_FAILED",
          description: "Native folder dialog failed.",
        });
      }
      const selected = output.replace(/\r?\n$/, "");
      return selected.length > 0 ? selected : null;
    }),
  ).pipe(
    Effect.mapError((cause) =>
      cause instanceof PathPickerError
        ? cause
        : new PathPickerError({
            code: "PATH_PICKER_OPEN_DIALOG_FAILED",
            description: "Native folder dialog failed.",
            cause,
          }),
    ),
  );
});
