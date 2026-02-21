import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { normalizeStudioLocale } from "@guerillaglass/localization";
import { CaptureRoute } from "../studio/routes/CaptureRoute";
import { DeliverRoute } from "../studio/routes/DeliverRoute";
import { EditRoute } from "../studio/routes/EditRoute";
import { StudioShellLayout } from "../studio/layout/StudioShellLayout";
import {
  getInitialStudioLocale,
  getInitialStudioPath,
  localizedRouteTargetFor,
  type StudioLayoutRoute,
} from "../studio/model/studioLayoutModel";

function redirectToLocalizedRoute(route: StudioLayoutRoute, locale: string): never {
  throw redirect({
    to: localizedRouteTargetFor(route),
    params: { locale: normalizeStudioLocale(locale) },
  });
}

function ensureCanonicalLocale(localeParam: string, route: StudioLayoutRoute): void {
  const normalizedLocale = normalizeStudioLocale(localeParam);
  if (normalizedLocale !== localeParam) {
    redirectToLocalizedRoute(route, normalizedLocale);
  }
}

const rootRoute = createRootRoute({
  component: StudioShellLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    redirectToLocalizedRoute("/capture", getInitialStudioLocale());
  },
});

const captureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale/capture",
  beforeLoad: ({ params }) => {
    ensureCanonicalLocale(params.locale, "/capture");
  },
  component: CaptureRoute,
});

const editRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale/edit",
  beforeLoad: ({ params }) => {
    ensureCanonicalLocale(params.locale, "/edit");
  },
  component: EditRoute,
});

const deliverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale/deliver",
  beforeLoad: ({ params }) => {
    ensureCanonicalLocale(params.locale, "/deliver");
  },
  component: DeliverRoute,
});

const legacyCaptureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/capture",
  beforeLoad: () => {
    redirectToLocalizedRoute("/capture", getInitialStudioLocale());
  },
});

const legacyEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/edit",
  beforeLoad: () => {
    redirectToLocalizedRoute("/edit", getInitialStudioLocale());
  },
});

const legacyDeliverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deliver",
  beforeLoad: () => {
    redirectToLocalizedRoute("/deliver", getInitialStudioLocale());
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  captureRoute,
  editRoute,
  deliverRoute,
  legacyCaptureRoute,
  legacyEditRoute,
  legacyDeliverRoute,
]);

export const appRouter = createRouter({
  history: createMemoryHistory({
    initialEntries: [getInitialStudioPath()],
  }),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
