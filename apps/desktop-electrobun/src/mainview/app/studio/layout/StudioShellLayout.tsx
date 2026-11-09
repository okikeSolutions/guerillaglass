import { ReplacementConfirmation } from "./ReplacementConfirmation";
import { Button } from "@guerillaglass/ui/components/button";
import * as m from "../../../../paraglide/messages.js";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStudioRenderDiagnostics } from "@lib/studioDiagnostics";
import { useStudio } from "../state/StudioProvider";
import {
  localizedRouteTargetFor,
  resolveStudioLocation,
  type StudioLayoutRoute,
} from "../contracts/studioLayoutModel";
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
  useStudioRenderDiagnostics("StudioShellLayout", {
    route: activeRoute,
  });

  return (
    <div className="h-full overflow-hidden bg-background">
      <div
        className="gg-shell-frame flex h-full w-full flex-col overflow-hidden"
        data-density={studio.densityMode}
      >
        <ReplacementConfirmation />
        <StudioShellHeader activeLocale={activeLocale} activeRoute={activeRoute} />
        <StudioTechnicalFeedbackStrip />

        <div
          className="flex-1 min-h-0 overflow-hidden"
          inert={studio.isRunningAction || Boolean(studio.captureStatusQuery.data?.isRecording)}
        >
          <Outlet />
        </div>
        <div className="h-12 shrink-0 border-t px-4 flex items-center gap-3" aria-live="polite">
          {studio.exportMutation.isPending ? (
            <span className="text-xs text-muted-foreground">
              {m.ui_io_export_pending(undefined, { locale: studio.locale })}
            </span>
          ) : studio.notice ? (
            <>
              <p
                className={
                  studio.notice.kind === "error"
                    ? "min-w-0 flex-1 overflow-y-auto max-h-10 text-xs text-destructive"
                    : "min-w-0 flex-1 truncate text-xs text-muted-foreground"
                }
              >
                {studio.notice.message}
              </p>
              <Button size="sm" variant="ghost" onClick={studio.clearNotice}>
                {m.ui_workflow_dismiss(undefined, { locale: studio.locale })}
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {studio.exportMutation.isPending
                ? m.ui_io_export_pending(undefined, { locale: studio.locale })
                : studio.captureStatusLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
