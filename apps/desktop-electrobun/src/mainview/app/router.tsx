import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { CaptureRoute } from "./routes/CaptureRoute";
import { DeliverRoute } from "./routes/DeliverRoute";
import { EditRoute } from "./routes/EditRoute";
import { StudioShellLayout } from "./routes/StudioShellLayout";

const rootRoute = createRootRoute({
  component: StudioShellLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/capture" });
  },
});

const captureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/capture",
  component: CaptureRoute,
});

const editRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/edit",
  component: EditRoute,
});

const deliverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deliver",
  component: DeliverRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, captureRoute, editRoute, deliverRoute]);

export const appRouter = createRouter({
  history: createMemoryHistory({
    initialEntries: ["/capture"],
  }),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
