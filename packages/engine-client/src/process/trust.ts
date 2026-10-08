import { Crypto, Effect, FileSystem, Option, Schema } from "effect";
import { EngineProcessError } from "../errors";

/**
 * Trust checks applied before spawning a native engine executable.
 */
export const EngineExecutableTrustPolicy = Schema.Struct({
  /** Enables executable trust checks. */
  enabled: Schema.optional(Schema.Boolean),
  /** Expected SHA-256 digest, with or without a sha256: prefix. */
  expectedSha256: Schema.optional(Schema.NullOr(Schema.String)),
  /** Reject symbolic-link executables; defaults to true. */
  rejectSymlinkExecutable: Schema.optional(Schema.Boolean),
  /** Reject group/world-writable executables; defaults to true. */
  rejectWorldWritable: Schema.optional(Schema.Boolean),
  /** Require ownership by the current user when the platform supports it. */
  requireCurrentUserOwner: Schema.optional(Schema.Boolean),
});
/** Trust policy applied before launching the native engine. */
export interface EngineExecutableTrustPolicy extends Schema.Schema.Type<
  typeof EngineExecutableTrustPolicy
> {}

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
export const validateEngineExecutableTrust = Effect.fn("trust.validateEngineExecutableTrust")(
  function (
    enginePath: string,
    policy: EngineExecutableTrustPolicy | undefined,
  ): Effect.Effect<void, EngineProcessError, Crypto.Crypto | FileSystem.FileSystem> {
    if (policy?.enabled !== true) {
      return Effect.void;
    }

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const crypto = yield* Crypto.Crypto;
      const linkTarget = yield* fs.readLink(enginePath).pipe(Effect.option);
      if ((policy.rejectSymlinkExecutable ?? true) && Option.isSome(linkTarget)) {
        return yield* new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable must not be a symbolic link in trusted mode.",
        });
      }

      const fileStat = yield* fs.stat(enginePath);
      if (fileStat.type !== "File") {
        return yield* new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable path must point to a regular file.",
        });
      }

      if ((policy.rejectWorldWritable ?? true) && (fileStat.mode & 0o022) !== 0) {
        return yield* new EngineProcessError({
          code: "ENGINE_TRUST_REJECTED",
          message: "Engine executable must not be group- or world-writable in trusted mode.",
        });
      }

      if (policy.requireCurrentUserOwner === true && typeof process.getuid === "function") {
        const currentUid = process.getuid();
        if (!Option.contains(fileStat.uid, currentUid)) {
          return yield* new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message: "Engine executable must be owned by the current user in trusted mode.",
          });
        }
      }

      const expectedSha256 = policy.expectedSha256?.trim();
      if (expectedSha256) {
        const bytes = yield* fs.readFile(enginePath);
        const digest = yield* crypto.digest("SHA-256", bytes);
        const actualSha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
          "",
        );
        if (!timingSafeEqualHex(actualSha256, expectedSha256)) {
          return yield* new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message: "Engine executable SHA-256 digest does not match the trusted allowlist.",
          });
        }
      }
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof EngineProcessError
          ? cause
          : new EngineProcessError({
              code: "ENGINE_TRUST_REJECTED",
              message: "Unable to verify engine executable trust.",
              cause,
            }),
      ),
    );
  },
);
