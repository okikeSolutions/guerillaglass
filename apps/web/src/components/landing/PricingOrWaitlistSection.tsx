import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";

export function PricingOrWaitlistSection({
  pricingOrWaitlist,
}: {
  pricingOrWaitlist: LandingContent["pricingOrWaitlist"];
}) {
  return (
    <section aria-label="Commercial model" className="status-card">
      <p className="eyebrow">Commercialization</p>
      <h2>{pricingOrWaitlist.title}</h2>
      <p>{pricingOrWaitlist.intro}</p>
      <div className="hero-actions">
        <CtaButton cta={pricingOrWaitlist.primaryCta} />
      </div>
    </section>
  );
}
