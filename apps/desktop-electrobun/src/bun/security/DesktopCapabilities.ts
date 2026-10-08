import { Clock, Context, Crypto, Effect, Layer, Redacted, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  desktopCapabilityTokenSchema,
  type DesktopCapabilityToken,
} from "../../shared/bridge/desktopBridgeContract";
import { CapabilityTokenError } from "../../shared/errors/desktopErrors";

export const desktopCapabilityScopes = [
  "review:mutate",
  "media:resolve-source",
  "capture:resolve-preview-url",
] as const;

/** Renderer actions that require an explicit host-issued capability. */
export const DesktopCapabilityScope = Schema.Literals(desktopCapabilityScopes);
export type DesktopCapabilityScope = typeof DesktopCapabilityScope.Type;

const CapabilityRecord = Schema.Struct({
  token: Schema.Redacted(desktopCapabilityTokenSchema),
  scope: DesktopCapabilityScope,
  subject: Schema.String,
  expiresAt: Schema.Finite,
  idleExpiresAt: Schema.Finite,
  idleTtlMs: Schema.Finite,
  singleUse: Schema.Boolean,
});
interface CapabilityRecord extends Schema.Schema.Type<typeof CapabilityRecord> {}

/** Scope, subject, and lifetime for a new capability grant. */
export const MintCapabilityParams = Schema.Struct({
  scope: DesktopCapabilityScope,
  subject: Schema.String,
  ttlMs: Schema.optional(Schema.Finite),
  idleTtlMs: Schema.optional(Schema.Finite),
  singleUse: Schema.optional(Schema.Boolean),
});
/** Validated capability minting parameters. */
export interface MintCapabilityParams extends Schema.Schema.Type<typeof MintCapabilityParams> {}

/** Token and authority expected by a protected request. */
export const ConsumeCapabilityParams = Schema.Struct({
  token: desktopCapabilityTokenSchema,
  scope: DesktopCapabilityScope,
  subject: Schema.String,
});
/** Validated capability consumption parameters. */
export interface ConsumeCapabilityParams extends Schema.Schema.Type<
  typeof ConsumeCapabilityParams
> {}

export type CapabilityGrantServiceShape = {
  readonly mint: (
    params: MintCapabilityParams,
  ) => Effect.Effect<DesktopCapabilityToken, CapabilityTokenError>;
  readonly consume: (params: ConsumeCapabilityParams) => Effect.Effect<void, CapabilityTokenError>;
  readonly revoke: (token: DesktopCapabilityToken) => Effect.Effect<void>;
};

export class CapabilityGrantService extends Context.Service<
  CapabilityGrantService,
  CapabilityGrantServiceShape
>()("@guerillaglass/desktop/CapabilityGrantService") {}

const defaultTtlMsByScope: Record<DesktopCapabilityScope, number> = {
  "review:mutate": 2 * 60 * 1000,
  "media:resolve-source": 60 * 1000,
  "capture:resolve-preview-url": 30 * 1000,
};

const defaultIdleTtlMsByScope: Record<DesktopCapabilityScope, number> = {
  "review:mutate": 2 * 60 * 1000,
  "media:resolve-source": 30 * 1000,
  "capture:resolve-preview-url": 15 * 1000,
};

function tokenError(description: string): CapabilityTokenError {
  return new CapabilityTokenError({ code: "CAPABILITY_TOKEN_INVALID", description });
}

/** Local opaque capability-token registry for privileged host bridge operations. */
export const makeCapabilityGrantService = Effect.fn("CapabilityGrantService.make")(function* (
  options: { maxEntries?: number } = {},
) {
  const crypto = yield* Crypto.Crypto;
  const maxEntries = Math.max(1, options.maxEntries ?? 1024);
  const records = new Map<string, CapabilityRecord>();

  function prune(now: number) {
    for (const [token, record] of records) {
      if (record.expiresAt <= now || record.idleExpiresAt <= now) {
        records.delete(token);
      }
    }
    while (records.size > maxEntries) {
      const oldest = records.keys().next().value;
      if (!oldest) {
        break;
      }
      records.delete(oldest);
    }
  }

  return CapabilityGrantService.of({
    mint: Effect.fn("CapabilityGrantService.mint")(function* (params: MintCapabilityParams) {
      const subject = params.subject.trim();
      if (subject.length === 0) {
        return yield* tokenError("Capability subject is required.");
      }
      const now = yield* Clock.currentTimeMillis;
      prune(now);
      const token = desktopCapabilityTokenSchema.make(
        Base64Url.encode(
          yield* crypto
            .randomBytes(32)
            .pipe(Effect.mapError(() => tokenError("Unable to mint capability token."))),
        ),
      );
      const ttlMs = Math.max(1, params.ttlMs ?? defaultTtlMsByScope[params.scope]);
      const idleTtlMs = Math.max(1, params.idleTtlMs ?? defaultIdleTtlMsByScope[params.scope]);
      records.set(token, {
        token: Redacted.make(token, { label: "desktop-capability-token" }),
        scope: params.scope,
        subject,
        expiresAt: now + ttlMs,
        idleExpiresAt: now + idleTtlMs,
        idleTtlMs,
        singleUse: params.singleUse ?? false,
      });
      return token;
    }),
    consume: Effect.fn("CapabilityGrantService.consume")(function* ({
      token,
      scope,
      subject,
    }: ConsumeCapabilityParams) {
      const now = yield* Clock.currentTimeMillis;
      prune(now);
      const normalizedToken = token.trim();
      const record = records.get(normalizedToken);
      if (!record) {
        return yield* tokenError("Missing or expired capability token.");
      }
      if (record.expiresAt <= now || record.idleExpiresAt <= now) {
        records.delete(normalizedToken);
        return yield* tokenError("Expired capability token.");
      }
      if (record.scope !== scope) {
        return yield* tokenError("Capability token scope mismatch.");
      }
      if (record.subject !== subject.trim()) {
        return yield* tokenError("Capability token subject mismatch.");
      }
      if (record.singleUse) {
        records.delete(normalizedToken);
      } else {
        records.set(normalizedToken, { ...record, idleExpiresAt: now + record.idleTtlMs });
      }
    }),
    revoke: Effect.fn("CapabilityGrantService.revoke")((token: DesktopCapabilityToken) =>
      Effect.sync(() => void records.delete(token.trim())),
    ),
  });
});

export const layerCapabilityGrantService = Layer.effect(
  CapabilityGrantService,
  makeCapabilityGrantService(),
);
