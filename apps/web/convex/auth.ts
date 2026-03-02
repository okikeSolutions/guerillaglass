import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";

type AuthRuntimeConfig = {
  betterAuthSecret: string;
  siteUrl: string;
  trustedOrigins: string[];
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Convex env var: ${name}`);
  }
  return value;
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }
  return value;
}

function toOrigin(value: string, source: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`Invalid URL provided for ${source}: "${value}"`);
  }
}

function parseTrustedOrigins(siteUrl: string): string[] {
  const configuredOrigins = readEnv("BETTER_AUTH_TRUSTED_ORIGINS");
  const origins = new Set<string>([toOrigin(siteUrl, "SITE_URL")]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }
  if (configuredOrigins) {
    for (const rawOrigin of configuredOrigins.split(",")) {
      const candidate = rawOrigin.trim();
      if (!candidate) {
        continue;
      }
      origins.add(toOrigin(candidate, "BETTER_AUTH_TRUSTED_ORIGINS"));
    }
  }
  return [...origins];
}

function loadAuthRuntimeConfig(): AuthRuntimeConfig {
  const siteUrl = requireEnv("SITE_URL");
  const betterAuthSecret = requireEnv("BETTER_AUTH_SECRET");
  return {
    betterAuthSecret,
    siteUrl,
    trustedOrigins: parseTrustedOrigins(siteUrl),
  };
}

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: {
    schema: authSchema,
  },
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const config = loadAuthRuntimeConfig();
  return {
    baseURL: config.siteUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: config.trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      organization({
        teams: { enabled: true },
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

const currentUserValidator = v.union(
  v.object({
    id: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  }),
  v.null(),
);

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export const getCurrentUser = query({
  args: {},
  returns: currentUserValidator,
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }
    return {
      id: String(user._id),
      name: normalizeString(user.name),
      email: normalizeString(user.email),
    };
  },
});
