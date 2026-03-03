import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hero } from "../components/landing/Hero";
import { landingContent } from "../content/landing";
import { trackLandingEvent } from "../lib/landing-analytics";

const scrollDepthThresholds = [25, 50, 75, 100] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: landingContent.seo.title,
      },
      {
        name: "description",
        content: landingContent.seo.description,
      },
      {
        name: "keywords",
        content: landingContent.seo.keywords.join(", "),
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    trackLandingEvent("page_view", {
      page: "landing",
      path: window.location.pathname,
    });

    const reachedDepth = new Set<number>();
    let frame = 0;

    const emitDepth = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        return;
      }

      const progress = Math.min(1, window.scrollY / scrollable);
      const percent = progress * 100;

      for (const threshold of scrollDepthThresholds) {
        if (percent >= threshold && !reachedDepth.has(threshold)) {
          reachedDepth.add(threshold);
          trackLandingEvent("scroll_depth", {
            page: "landing",
            threshold,
          });
        }
      }
    };

    const onScroll = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        emitDepth();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    emitDepth();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="landing-shell dark" id="main-content">
        <Hero />
      </main>
    </>
  );
}
