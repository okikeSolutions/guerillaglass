import type { LandingContent } from "../../content/landing";
import { MediaAsset } from "./MediaAsset";
import { RevealOnScroll } from "./RevealOnScroll";

export function FeatureCardGrid({ section }: { section: LandingContent["featureCardGrid"] }) {
  return (
    <section className="feature-card-grid-section" id={section.sectionId}>
      <RevealOnScroll className="section-copy-block">
        <h2>{section.heading}</h2>
        <p>{section.body}</p>
      </RevealOnScroll>
      <div className="feature-card-grid">
        {section.cards.map((card) => (
          <RevealOnScroll className="feature-card" key={card.title}>
            <MediaAsset className="feature-card-media" media={card.media} />
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
