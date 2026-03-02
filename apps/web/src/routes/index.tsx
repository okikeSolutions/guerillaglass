import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  FAQAccordion,
  FeatureCardGrid,
  FeatureFullBleedSection,
  FeatureSplitSection,
  FootnotesSection,
  GlobalFooter,
  GlobalHeader,
  Hero,
  PricingSection,
  StickySectionNav,
  WorkflowEcosystemSection,
} from "../components/landing";
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
  React.useEffect(() => {
    trackLandingEvent("page_view", {
      page: "landing",
      path: window.location.pathname,
    });

    const reachedDepth = new Set<number>();
    let frame = 0;

    const emitDepth = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
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
      <main className="landing-shell" id="main-content">
        <GlobalHeader globalHeader={landingContent.globalHeader} />
        <Hero hero={landingContent.hero} />
        <StickySectionNav
          cta={landingContent.stickySectionNav.cta}
          heroSectionId={landingContent.hero.sectionId}
          links={landingContent.stickySectionNav.links}
        />
        {landingContent.featureSplitSections.map((section) => (
          <FeatureSplitSection key={section.sectionId} section={section} />
        ))}
        <FeatureFullBleedSection section={landingContent.featureFullBleedSection} />
        <FeatureCardGrid section={landingContent.featureCardGrid} />
        <WorkflowEcosystemSection section={landingContent.workflowSection} />
        <PricingSection section={landingContent.pricingSection} />
        <FAQAccordion section={landingContent.faqSection} />
        <FootnotesSection section={landingContent.footnotesSection} />
        <GlobalFooter footer={landingContent.globalFooter} />
      </main>
    </>
  );
}
