import type { LandingContent } from "../../content/landing";
import { RevealOnScroll } from "./RevealOnScroll";

export function FAQAccordion({ section }: { section: LandingContent["faqSection"] }) {
  return (
    <section className="faq-section" id={section.sectionId}>
      <RevealOnScroll className="section-copy-block">
        <h2>{section.heading}</h2>
      </RevealOnScroll>
      <div className="faq-accordion">
        {section.items.map((item) => (
          <RevealOnScroll className="faq-item" key={item.question}>
            <details>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
