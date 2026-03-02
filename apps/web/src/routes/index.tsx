import { createFileRoute } from "@tanstack/react-router";
import {
  CinematicDemosSection,
  FaqSection,
  FinalCtaSection,
  HeroSection,
  PlatformParitySection,
  PricingOrWaitlistSection,
  TrustSection,
  WorkflowSection,
} from "../components/landing";
import { landingContent } from "../content/landing";

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
  return (
    <main className="landing-shell">
      <HeroSection hero={landingContent.hero} />
      <WorkflowSection workflow={landingContent.workflow} />
      <CinematicDemosSection cinematicDemos={landingContent.cinematicDemos} />
      <TrustSection trust={landingContent.trust} />
      <PlatformParitySection platformParity={landingContent.platformParity} />
      <PricingOrWaitlistSection pricingOrWaitlist={landingContent.pricingOrWaitlist} />
      <FaqSection faq={landingContent.faq} />
      <FinalCtaSection finalCta={landingContent.finalCta} />
    </main>
  );
}
