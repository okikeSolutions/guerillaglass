import type { LandingContent } from "../../content/landing";
import { MediaAsset } from "./MediaAsset";

export function FeatureFullBleedSection({
  section,
}: {
  section: LandingContent["featureFullBleedSection"];
}) {
  return (
    <section className="feature-full-bleed" id={section.sectionId}>
      <MediaAsset className="feature-full-bleed-media" media={section.media} />
      <div className="feature-full-bleed-overlay">
        <h2>{section.heading}</h2>
        <p>{section.body}</p>
      </div>
    </section>
  );
}
