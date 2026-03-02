import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, notifyManager } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { routeTree } from "./routeTree.gen";

function getConvexUrl(): string {
  const convexUrl = (import.meta as ImportMeta & { env: { VITE_CONVEX_URL?: string } }).env
    .VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL must be set to initialize the web app.");
  }
  return convexUrl;
}

function DefaultError({ error }: { error: Error }) {
  return (
    <main className="landing-shell">
      <section className="status-card">
        <h1>Route Error</h1>
        <p>{error.message}</p>
      </section>
    </main>
  );
}

function DefaultNotFound() {
  return (
    <main className="landing-shell">
      <section className="status-card">
        <h1>Page Not Found</h1>
        <p>The requested route does not exist.</p>
      </section>
    </main>
  );
}

export function getRouter() {
  if (typeof window !== "undefined") {
    notifyManager.setScheduler(window.requestAnimationFrame);
  }

  const convexQueryClient = new ConvexQueryClient(getConvexUrl(), {
    expectAuth: true,
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });

  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    context: {
      queryClient,
      convexQueryClient,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error }) => <DefaultError error={error} />,
    defaultNotFoundComponent: () => <DefaultNotFound />,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children as ReactNode}
      </ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}
