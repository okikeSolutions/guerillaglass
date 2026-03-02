import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProvider } from "convex/react";
import type { ReactElement, ReactNode } from "react";
import { routeTree } from "./routeTree.gen";

type WrapChildren = (children: ReactNode) => ReactElement;

function passthrough(children: ReactNode): ReactElement {
  return <>{children}</>;
}

function createConvexWrapper(convexUrl: string): {
  queryClient: QueryClient;
  wrapChildren: WrapChildren;
} {
  const convexQueryClient = new ConvexQueryClient(convexUrl);
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

  return {
    queryClient,
    wrapChildren: (children) => (
      <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
    ),
  };
}

export function getRouter() {
  const convexUrl = (import.meta as ImportMeta & { env: { VITE_CONVEX_URL?: string } }).env
    .VITE_CONVEX_URL;

  const { queryClient, wrapChildren } = convexUrl
    ? createConvexWrapper(convexUrl)
    : { queryClient: new QueryClient(), wrapChildren: passthrough };

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
      defaultErrorComponent: ({ error }) => (
        <main className="landing-shell">
          <section className="status-card">
            <h1>Route Error</h1>
            <p>{error.message}</p>
          </section>
        </main>
      ),
      defaultNotFoundComponent: () => (
        <main className="landing-shell">
          <section className="status-card">
            <h1>Page Not Found</h1>
            <p>The requested route does not exist.</p>
          </section>
        </main>
      ),
      Wrap: ({ children }) => wrapChildren(children),
    }),
    queryClient,
  );

  return router;
}
