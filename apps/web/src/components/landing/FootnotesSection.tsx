import type { LandingContent } from "../../content/landing";

export function FootnotesSection({ section }: { section: LandingContent["footnotesSection"] }) {
  return (
    <section className="footnotes-section" id="footnotes">
      <h2>{section.heading}</h2>
      <ul>
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="footnotes-links">
        {section.legalLinks.map((link) => (
          <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
