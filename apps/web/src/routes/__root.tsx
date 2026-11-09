import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import * as m from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { themeInitScript } from "../lib/appearance";
import "../styles.css";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient?: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: m.web_ui_meta_title() },
      { name: "description", content: m.web_ui_meta_description() },
    ],
  }),
  // Public routes must render without fetching a hosted auth token. Future
  // authenticated routes must own their auth loader/provider at that boundary.
  notFoundComponent: NotFoundPage,
  errorComponent: PublicPageError,
  shellComponent: RootComponent,
});

function RootComponent() {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <main className="public-site site-section site-prose">
      <p className="site-eyebrow">404</p>
      <h1>{m.web_ui_not_found()}</h1>
      <p>{m.web_ui_not_found_body()}</p>
      <a className="site-button" href="/">
        {m.web_ui_back()}
      </a>
    </main>
  );
}

function PublicPageError({ reset }: { reset: () => void }) {
  return (
    <main className="public-site site-section site-prose">
      <h1>{m.web_ui_error_title()}</h1>
      <p>{m.web_ui_error_body()}</p>
      <button className="site-button" type="button" onClick={reset}>
        {m.web_ui_retry()}
      </button>
      <a className="site-text-link" href="/">
        {m.web_ui_back()}
      </a>
    </main>
  );
}
