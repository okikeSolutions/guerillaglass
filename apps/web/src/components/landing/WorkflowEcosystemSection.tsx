import type { LandingContent } from "../../content/landing";
import { RevealOnScroll } from "./RevealOnScroll";

export function WorkflowEcosystemSection({
  section,
}: {
  section: LandingContent["workflowSection"];
}) {
  return (
    <section className="workflow-ecosystem-section" id={section.sectionId}>
      <RevealOnScroll className="section-copy-block">
        <h2>{section.heading}</h2>
        <p>{section.body}</p>
      </RevealOnScroll>
      <div className="workflow-ecosystem-grid">
        {section.items.map((item) => (
          <RevealOnScroll className="workflow-ecosystem-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
