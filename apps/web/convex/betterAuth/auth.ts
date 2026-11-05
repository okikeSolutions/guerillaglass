import { betterAuth } from "better-auth/minimal";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "../_generated/dataModel";
import { createAuthOptions } from "../auth";

// The CLI only inspects the adapter schema; it never calls the database context.
export const auth = betterAuth(createAuthOptions({} as GenericCtx<DataModel>));
