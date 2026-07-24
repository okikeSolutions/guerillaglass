import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { AuthClient } from "@convex-dev/better-auth/react";

// @convex-dev/better-auth's public provider type currently loses the concrete
// session type from Better Auth 1.6; the configured Convex plugin is runtime-compatible.
export const authClient = createAuthClient({
  plugins: [convexClient()],
}) as unknown as AuthClient;
