import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";

export function FinalCtaSection({ finalCta }: { finalCta: LandingContent["finalCta"] }) {
  return (
    <section aria-label="Final CTA" className="hero-card">
      <p className="eyebrow">Start now</p>
      <h2>{finalCta.title}</h2>
      <p className="hero-copy">{finalCta.copy}</p>
      <div className="hero-actions">
        <CtaButton cta={finalCta.primary} />
        <CtaButton cta={finalCta.secondary} />
      </div>
    </section>
  );
}
