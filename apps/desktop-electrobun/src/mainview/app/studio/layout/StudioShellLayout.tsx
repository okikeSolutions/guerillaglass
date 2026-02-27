import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStudio } from "../state/StudioProvider";
import {
  localizedRouteTargetFor,
  resolveStudioLocation,
  type StudioLayoutRoute,
} from "../model/studioLayoutModel";
import { StudioShellHeader } from "./StudioShellHeader";
import { StudioTechnicalFeedbackStrip } from "./StudioTechnicalFeedbackStrip";

function useStudioLocaleRouteSync({
  activeLocale,
  activeRoute,
  locale,
  setLastRoute,
}: {
  activeLocale: string;
  activeRoute: StudioLayoutRoute;
  locale: string;
  setLastRoute: (route: StudioLayoutRoute) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (activeLocale === locale) {
      return;
    }

    setLastRoute(activeRoute);
    void navigate({
      to: localizedRouteTargetFor(activeRoute),
      params: { locale },
      replace: true,
    });
  }, [activeLocale, activeRoute, locale, navigate, setLastRoute]);
}

export function StudioShellLayout() {
  const studio = useStudio();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const location = resolveStudioLocation(pathname);
  const activeRoute = location.route;
  const activeLocale = location.locale;

  useStudioLocaleRouteSync({
    activeLocale,
    activeRoute,
    locale: studio.locale,
    setLastRoute: studio.setLastRoute,
  });

  return (
    <div className="h-full overflow-hidden bg-background">
      <div
        className="gg-shell-frame flex h-full w-full flex-col overflow-hidden"
        data-density={studio.densityMode}
      >
        <StudioShellHeader activeLocale={activeLocale} activeRoute={activeRoute} />
        <StudioTechnicalFeedbackStrip />

        {studio.notice ? (
          <Alert
            variant={studio.notice.kind === "error" ? "destructive" : "default"}
            className="rounded-none border-x-0 border-t-0 border-b px-4 py-3 text-sm"
          >
            <AlertDescription>{studio.notice.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
