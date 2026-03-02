import { Card, CardDescription, CardHeader, CardTitle } from "@guerillaglass/ui/ui/card";
import type { LandingContent } from "../../content/landing";

export function CinematicDemosSection({
  cinematicDemos,
}: {
  cinematicDemos: LandingContent["cinematicDemos"];
}) {
  return (
    <section aria-label="Cinematic defaults" className="landing-section">
      <header className="section-header">
        <p className="eyebrow">Cinematic</p>
        <h2>{cinematicDemos.title}</h2>
        <p>{cinematicDemos.intro}</p>
      </header>
      <div className="demo-grid">
        {cinematicDemos.items.map((item) => (
          <Card className="demo-card" key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
