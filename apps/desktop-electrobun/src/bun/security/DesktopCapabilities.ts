import { randomBytes } from "node:crypto";
import { Context, Effect, Layer, Redacted } from "effect";
import { CapabilityTokenError } from "../../shared/errors/desktopErrors";

export const desktopCapabilityScopes = [
  "review:mutate",
  "media:resolve-source",
  "capture:resolve-preview-url",
] as const;

export type DesktopCapabilityScope = (typeof desktopCapabilityScopes)[number];

type CapabilityRecord = {
  readonly token: Redacted.Redacted<string>;
  readonly scope: DesktopCapabilityScope;
  readonly subject: string;
  readonly expiresAt: number;
  readonly idleExpiresAt: number;
  readonly idleTtlMs: number;
  readonly singleUse: boolean;
};

export type MintCapabilityParams = {
  readonly scope: DesktopCapabilityScope;
  readonly subject: string;
  readonly ttlMs?: number;
  readonly idleTtlMs?: number;
  readonly singleUse?: boolean;
};

export type ConsumeCapabilityParams = {
  readonly token: string;
  readonly scope: DesktopCapabilityScope;
  readonly subject: string;
};

export type CapabilityGrantServiceShape = {
  readonly mint: (params: MintCapabilityParams) => Effect.Effect<string, CapabilityTokenError>;
  readonly consume: (params: ConsumeCapabilityParams) => Effect.Effect<void, CapabilityTokenError>;
  readonly revoke: (token: string) => Effect.Effect<void>;
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

function makeOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenError(description: string): CapabilityTokenError {
  return new CapabilityTokenError({ code: "CAPABILITY_TOKEN_INVALID", description });
}

/** Local opaque capability-token registry for privileged host bridge operations. */
export function makeCapabilityGrantService(
  options: { maxEntries?: number } = {},
): CapabilityGrantServiceShape {
  const maxEntries = Math.max(1, options.maxEntries ?? 1024);
  const records = new Map<string, CapabilityRecord>();

  function prune(now = Date.now()) {
    for (const [token, record] of records) {
      if (record.expiresAt <= now || record.idleExpiresAt <= now) {
        records.delete(token);
      }
    }
    while (records.size > maxEntries) {
      const oldest = records.keys().next().value as string | undefined;
      if (!oldest) break;
      records.delete(oldest);
    }
  }

  return {
    mint: (params) =>
      Effect.try({
        try: () => {
          const subject = params.subject.trim();
          if (subject.length === 0) {
            throw tokenError("Capability subject is required.");
          }
          prune();
          const token = makeOpaqueToken();
          const now = Date.now();
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
        },
        catch: (error) => error as CapabilityTokenError,
      }),
    consume: ({ token, scope, subject }) =>
      Effect.try({
        try: () => {
          prune();
          const normalizedToken = token.trim();
          const record = records.get(normalizedToken);
          if (!record) {
            throw tokenError("Missing or expired capability token.");
          }
          const now = Date.now();
          if (record.expiresAt <= now || record.idleExpiresAt <= now) {
            records.delete(normalizedToken);
            throw tokenError("Expired capability token.");
          }
          if (record.scope !== scope) {
            throw tokenError("Capability token scope mismatch.");
          }
          if (record.subject !== subject.trim()) {
            throw tokenError("Capability token subject mismatch.");
          }
          if (record.singleUse) {
            records.delete(normalizedToken);
          } else {
            records.set(normalizedToken, { ...record, idleExpiresAt: now + record.idleTtlMs });
          }
        },
        catch: (error) => error as CapabilityTokenError,
      }),
    revoke: (token) => Effect.sync(() => void records.delete(token.trim())),
  };
}

export const layerCapabilityGrantService = Layer.succeed(
  CapabilityGrantService,
  makeCapabilityGrantService(),
);
