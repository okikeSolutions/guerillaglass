import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { Context, Effect, Layer } from "effect";
import { FileAccessPolicyError } from "../../shared/errors/desktopErrors";

// Effect FileSystem.open only accepts string flags. This platform adapter retains
// O_NOFOLLOW and O_EXCL so final-component symlink races cannot bypass policy.
export class NoFollowFileIO extends Context.Service<
  NoFollowFileIO,
  {
    readonly readText: (
      filePath: string,
      maxBytes: number,
    ) => Effect.Effect<string, FileAccessPolicyError>;
    readonly copySnapshot: (
      source: string,
      destination: string,
      maxBytes: number,
    ) => Effect.Effect<string, FileAccessPolicyError>;
  }
>()("@guerillaglass/desktop/NoFollowFileIO") {}

function ioError(cause: unknown): FileAccessPolicyError {
  return cause instanceof FileAccessPolicyError
    ? cause
    : new FileAccessPolicyError({
        code: "PATH_NOT_FILE",
        description: "Unable to access a regular local file safely.",
        cause,
      });
}

async function rejectFinalSymlink(filePath: string): Promise<void> {
  const fileStat = await lstat(filePath);
  if (fileStat.isSymbolicLink()) {
    throw new FileAccessPolicyError({
      code: "PATH_NOT_FILE",
      description: "Path must point to a regular file, not a symbolic link.",
    });
  }
}

async function openNoFollowRead(filePath: string) {
  await rejectFinalSymlink(filePath);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  return await open(filePath, constants.O_RDONLY | noFollow);
}

/** Copies a file through no-follow handles to create an app-owned immutable serving snapshot. */
async function copyNoFollow(
  sourcePath: string,
  destinationPath: string,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const sourceHandle = await openNoFollowRead(sourcePath);
  try {
    const destinationHandle = await open(
      destinationPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    try {
      const fileStat = await sourceHandle.stat();
      if (!fileStat.isFile()) {
        throw new FileAccessPolicyError({
          code: "PATH_NOT_FILE",
          description: "Path must point to a file.",
        });
      }

      if (fileStat.size > maxBytes) {
        throw new FileAccessPolicyError({
          code: "FILE_TOO_LARGE",
          description: `File too large to snapshot safely (max ${maxBytes} bytes).`,
        });
      }

      const buffer = Buffer.allocUnsafe(1024 * 1024);
      let copiedBytes = 0;
      while (true) {
        signal.throwIfAborted();
        const { bytesRead } = await sourceHandle.read(buffer, 0, buffer.byteLength, null);
        if (bytesRead === 0) {
          break;
        }
        copiedBytes += bytesRead;
        if (copiedBytes > maxBytes) {
          throw new FileAccessPolicyError({
            code: "FILE_TOO_LARGE",
            description: `File too large to snapshot safely (max ${maxBytes} bytes).`,
          });
        }
        let written = 0;
        while (written < bytesRead) {
          const result = await destinationHandle.write(buffer, written, bytesRead - written);
          if (result.bytesWritten === 0) {
            throw new Error("Snapshot write made no progress");
          }
          written += result.bytesWritten;
        }
      }
      return destinationPath;
    } finally {
      await destinationHandle.close();
    }
  } finally {
    await sourceHandle.close();
  }
}

/** Reads a validated JSON text file with size and root constraints applied. */
async function readNoFollow(
  filePath: string,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const resolvedPath = filePath;
  const handle = await openNoFollowRead(resolvedPath);
  try {
    const fileStat = await handle.stat();
    if (!fileStat.isFile()) {
      throw new FileAccessPolicyError({
        code: "PATH_NOT_FILE",
        description: "Path must point to a file.",
      });
    }

    if (fileStat.size > maxBytes) {
      throw new FileAccessPolicyError({
        code: "FILE_TOO_LARGE",
        description: `File too large to read safely (max ${maxBytes} bytes).`,
      });
    }

    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1));
    let totalBytes = 0;
    while (true) {
      signal.throwIfAborted();
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) {
        break;
      }
      totalBytes += bytesRead;
      if (totalBytes > maxBytes) {
        throw new FileAccessPolicyError({
          code: "FILE_TOO_LARGE",
          description: `File too large to read safely (max ${maxBytes} bytes).`,
        });
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return Buffer.concat(chunks, totalBytes).toString("utf8");
  } finally {
    await handle.close();
  }
}

export const layerNoFollowFileIO = Layer.sync(NoFollowFileIO, () =>
  NoFollowFileIO.of({
    readText: Effect.fn("NoFollowFileIO.readText")((filePath: string, maxBytes: number) =>
      Effect.tryPromise({
        try: (signal) => readNoFollow(filePath, maxBytes, signal),
        catch: ioError,
      }),
    ),
    copySnapshot: Effect.fn("NoFollowFileIO.copySnapshot")(
      (source: string, destination: string, maxBytes: number) =>
        Effect.tryPromise({
          try: (signal) => copyNoFollow(source, destination, maxBytes, signal),
          catch: ioError,
        }),
    ),
  }),
);
