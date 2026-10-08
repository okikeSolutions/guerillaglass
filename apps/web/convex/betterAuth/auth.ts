import { betterAuth } from "better-auth/minimal";
import { authOptions } from "../auth";

// Schema generation needs auth plugins and options without a live Convex database context.
export const auth = betterAuth(authOptions);
