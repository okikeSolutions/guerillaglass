import { Badge } from "@guerillaglass/ui/ui/badge";
import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";

export function HeroSection({ hero }: { hero: LandingContent["hero"] }) {
  return (
    <section className="hero-card" id="hero">
      <p className="eyebrow">{hero.eyebrow}</p>
      <h1>{hero.title}</h1>
      <p className="hero-copy">{hero.copy}</p>
      <div aria-label="Product positioning" className="hero-badges">
        {hero.badges.map((badge) => (
          <Badge key={badge} variant="secondary">
            {badge}
          </Badge>
        ))}
      </div>
      <div className="hero-actions">
        {hero.ctas.map((cta) => (
          <CtaButton cta={cta} key={cta.label} />
        ))}
      </div>
    </section>
  );
}
