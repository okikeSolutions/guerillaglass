import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";
import { MediaAsset } from "./MediaAsset";
import { RevealOnScroll } from "./RevealOnScroll";

export function Hero({ hero }: { hero: LandingContent["hero"] }) {
  return (
    <section className="hero" id={hero.sectionId}>
      <RevealOnScroll>
        <div className="hero-copy">
          <h1>{hero.headline}</h1>
          <p>{hero.subhead}</p>
          <div className="hero-actions">
            <CtaButton cta={hero.primaryCta} section="hero" />
            <CtaButton cta={hero.secondaryCta} section="hero" />
          </div>
        </div>
      </RevealOnScroll>
      <RevealOnScroll className="hero-media-wrap">
        <MediaAsset className="hero-media" media={hero.backgroundMedia} priority />
      </RevealOnScroll>
    </section>
  );
}
