import type { LandingContent } from "../../content/landing";

export function TrustSection({ trust }: { trust: LandingContent["trust"] }) {
  return (
    <section aria-label="Trust" className="status-card">
      <p className="eyebrow">Trust</p>
      <h2>{trust.title}</h2>
      <p>{trust.intro}</p>
      <ul>
        {trust.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
