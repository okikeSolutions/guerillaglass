import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  // Public pages work without a configured or reachable hosted service.
  const convexQueryClient = convexUrl
    ? new ConvexQueryClient(convexUrl, { expectAuth: true })
    : undefined;
  const queryClient = new QueryClient({
    defaultOptions: convexQueryClient
      ? {
          queries: {
            queryKeyHashFn: convexQueryClient.hashFn(),
            queryFn: convexQueryClient.queryFn(),
          },
        }
      : undefined,
  });
  convexQueryClient?.connect(queryClient);
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}
