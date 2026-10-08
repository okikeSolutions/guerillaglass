import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { AuthClient } from "@convex-dev/better-auth/react";

export const authClient = createAuthClient({
  plugins: [convexClient()],
  // @convex-dev/better-auth's AuthClient union resolves useSession data to `never`
  // for the supported Better Auth 1.6 client even with its configured Convex plugin.
}) as unknown as AuthClient;
