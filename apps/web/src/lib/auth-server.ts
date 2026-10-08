import { Config, Effect } from "effect";
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const config = Effect.runSync(
  Config.all({
    convexUrl: Config.URL("VITE_CONVEX_URL").pipe(Config.map(String)),
    convexSiteUrl: Config.URL("VITE_CONVEX_SITE_URL").pipe(Config.map(String)),
  }),
);

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    ...config,
  });
