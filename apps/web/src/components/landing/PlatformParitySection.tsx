import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@guerillaglass/ui/ui/card";
import type { LandingContent } from "../../content/landing";

export function PlatformParitySection({
  platformParity,
}: {
  platformParity: LandingContent["platformParity"];
}) {
  return (
    <Card aria-label="Platform parity" className="status-card">
      <CardHeader>
        <p className="eyebrow">Platforms</p>
        <CardTitle>{platformParity.title}</CardTitle>
        <CardDescription>{platformParity.intro}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="platform-grid">
          {platformParity.rows.map((row) => (
            <article className="platform-row" key={row.platform}>
              <h3>{row.platform}</h3>
              <p>{row.status}</p>
              <p className="platform-note">{row.note}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
