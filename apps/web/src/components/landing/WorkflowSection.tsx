import { Card, CardDescription, CardHeader, CardTitle } from "@guerillaglass/ui/ui/card";
import type { LandingContent } from "../../content/landing";

export function WorkflowSection({ workflow }: { workflow: LandingContent["workflow"] }) {
  return (
    <section aria-label="Workflow" className="landing-section">
      <header className="section-header">
        <p className="eyebrow">Workflow</p>
        <h2>{workflow.title}</h2>
        <p>{workflow.intro}</p>
      </header>
      <div className="pillar-grid">
        {workflow.items.map((item) => (
          <Card className="pillar-card" key={item.title} size="sm">
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
