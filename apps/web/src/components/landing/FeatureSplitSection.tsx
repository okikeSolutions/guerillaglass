import type { LandingContent } from "../../content/landing";
import { MediaAsset } from "./MediaAsset";
import { RevealOnScroll } from "./RevealOnScroll";

type FeatureSplitSectionProps = {
  section: LandingContent["featureSplitSections"][number];
};

export function FeatureSplitSection({ section }: FeatureSplitSectionProps) {
  return (
    <section
      className={[
        "feature-split-section",
        section.mediaSide === "left" ? "media-left" : "media-right",
        section.theme === "light" ? "theme-light" : "theme-dark",
      ].join(" ")}
      id={section.sectionId}
    >
      <div className="feature-split-grid">
        <RevealOnScroll className="feature-split-copy">
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </RevealOnScroll>
        <RevealOnScroll className="feature-split-media-wrap">
          <MediaAsset className="feature-split-media" media={section.media} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
