import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = process.env.VITE_CONVEX_URL;
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required for Better Auth server integration.");
}

if (!convexSiteUrl) {
  throw new Error("VITE_CONVEX_SITE_URL is required for Better Auth server integration.");
}

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl,
    convexSiteUrl,
  });
