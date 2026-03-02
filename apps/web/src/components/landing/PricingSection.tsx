import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";
import { RevealOnScroll } from "./RevealOnScroll";

export function PricingSection({ section }: { section: LandingContent["pricingSection"] }) {
  return (
    <section className="pricing-section" id={section.sectionId}>
      <RevealOnScroll className="section-copy-block">
        <h2>{section.heading}</h2>
        <p>{section.body}</p>
      </RevealOnScroll>
      <div className="pricing-grid">
        {section.plans.map((plan) => (
          <RevealOnScroll
            className={["pricing-card", plan.featured ? "is-featured" : ""].join(" ")}
            key={plan.name}
          >
            <p className="pricing-name">{plan.name}</p>
            <h3>{plan.price}</h3>
            <p>{plan.description}</p>
            <ul>
              {plan.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <CtaButton cta={plan.cta} section={`pricing_${plan.name.toLowerCase()}`} />
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
