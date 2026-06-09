import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import { Effect } from "effect";
import { EngineProcessError } from "../errors";

/**
 * Trust checks applied before spawning a native engine executable.
 */
export type EngineExecutableTrustPolicy = {
  /**
   * Enables trust checks when true.
   */
  readonly enabled?: boolean;
  /**
   * Expected SHA-256 digest for the executable, with or without a `sha256:` prefix.
   */
  readonly expectedSha256?: string | null;
  /**
   * Reject symbolic-link executables.
   *
   * @defaultValue true
   */
  readonly rejectSymlinkExecutable?: boolean;
  /**
   * Reject executables writable by group or world.
   *
   * @defaultValue true
   */
  readonly rejectWorldWritable?: boolean;
  /**
   * Require the executable to be owned by the current user when `process.getuid` is available.
   */
  readonly requireCurrentUserOwner?: boolean;
};

/**
 * Normalizes a SHA-256 digest string for comparison.
 *
 * @param value - Digest value to normalize.
 * @returns Lowercase hex digest without a `sha256:` prefix.
 */
function normalizeSha256(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^sha256:/, "");
}

/**
 * Compares two normalized SHA-256 hex strings after validating their shape.
 *
 * @param left - First digest.
 * @param right - Second digest.
 * @returns Whether both digests are valid and equal.
 */
function timingSafeEqualHex(left: string, right: string): boolean {
  const normalizedLeft = normalizeSha256(left);
  const normalizedRight = normalizeSha256(right);
  if (!/^[0-9a-f]{64}$/.test(normalizedLeft) || !/^[0-9a-f]{64}$/.test(normalizedRight)) {
    return false;
  }
  return normalizedLeft === normalizedRight;
}

/**
 * Verifies local filesystem trust constraints for the engine executable.
 *
 * @param enginePath - Absolute path to the engine executable.
 * @param policy - Optional trust policy.
 * @returns An effect that succeeds when the executable is trusted.
 */
export function validateEngineExecutableTrust(
  enginePath: string,
  policy: EngineExecutableTrustPolicy | undefined,
): Effect.Effect<void, EngineProcessError> {
  if (policy?.enabled !== true) return Effect.void;

  return Effect.tryPromise({
    try: async () => {
      const linkStat = await lstat(enginePath);
      if ((policy.rejectSymlinkExecutable ?? true) && linkStat.isSymbolicLink()) {
        throw new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable must not be a symbolic link in trusted mode.",
        });
      }

      const fileStat = await stat(enginePath);
      if (!fileStat.isFile()) {
        throw new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable path must point to a regular file.",
        });
      }

      if ((policy.rejectWorldWritable ?? true) && (fileStat.mode & 0o022) !== 0) {
        throw new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable must not be group- or world-writable in trusted mode.",
        });
      }

      if (policy.requireCurrentUserOwner === true && typeof process.getuid === "function") {
        const currentUid = process.getuid();
        if (fileStat.uid !== currentUid) {
          throw new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message: "Engine executable must be owned by the current user in trusted mode.",
          });
        }
      }

      const expectedSha256 = policy.expectedSha256?.trim();
      if (expectedSha256) {
        const actualSha256 = createHash("sha256")
          .update(await readFile(enginePath))
          .digest("hex");
        if (!timingSafeEqualHex(actualSha256, expectedSha256)) {
          throw new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message: "Engine executable SHA-256 digest does not match the trusted allowlist.",
          });
        }
      }
    },
    catch: (cause) =>
      cause instanceof EngineProcessError
        ? cause
        : new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message: "Unable to verify engine executable trust.",
            cause,
          }),
  });
}
