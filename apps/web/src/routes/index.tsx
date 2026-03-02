import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@guerillaglass/ui/ui/accordion";
import { Badge } from "@guerillaglass/ui/ui/badge";
import { buttonVariants } from "@guerillaglass/ui/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@guerillaglass/ui/ui/card";
import { cn } from "@guerillaglass/ui/lib/utils";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const heroBadges = ["Local-first", "Editor-first", "Deterministic exports"] as const;

const workflowPillars = [
  {
    title: "Capture",
    detail:
      "Native display/window capture with engine telemetry and permissions-aware degraded modes.",
  },
  {
    title: "Edit",
    detail:
      "Timeline, preview, and inspector stay visible as first-class surfaces with keyboard-first control.",
  },
  {
    title: "Deliver",
    detail:
      "Local deterministic export by default, then optional async review workflows when teams need them.",
  },
] as const;

const cinematicDefaults = [
  "Auto-zoom and reframing",
  "Cursor smoothing and click emphasis",
  "Motion blur and polished camera movement",
  "Vertical exports with re-planned framing",
] as const;

const faqItems = [
  {
    question: "Does capture/edit/export work without cloud services?",
    answer:
      "Yes. Local capture, edit, and deterministic export are core paths and are not gated by cloud availability.",
  },
  {
    question: "What happens when Input Monitoring is denied?",
    answer:
      "Recording continues. Input-driven cinematic features degrade gracefully and the UI surfaces the degraded state.",
  },
  {
    question: "What does deterministic export mean here?",
    answer:
      "Pre-encode frame buffers remain reproducible for the same project/version/settings/hardware class; encoded bytes can still differ.",
  },
] as const;

function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <p className="eyebrow">Guerilla Glass</p>
        <h1>Record. Edit. Deliver. Cinematic by default.</h1>
        <p className="hero-copy">
          Built for creators who want native capture discipline, editor-first control, and polished
          outputs without cloud lock-in.
        </p>
        <div className="hero-badges" aria-label="Product positioning">
          {heroBadges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </div>
        <div className="hero-actions">
          <a
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "button button-primary",
            )}
            href="https://github.com/okikeSolutions/guerillaglass"
            rel="noreferrer"
            target="_blank"
          >
            View Repository
          </a>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "button")}
            to="/workspace/$mode"
            params={{ mode: "capture" }}
          >
            Open Workspace
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "button")}
            to="/anotherPage"
          >
            Open Convex Demo Route
          </Link>
        </div>
      </section>

      <section className="pillar-grid" aria-label="Workflow pillars">
        {workflowPillars.map((pillar) => (
          <Card className="pillar-card" key={pillar.title} size="sm">
            <CardHeader>
              <CardTitle>{pillar.title}</CardTitle>
              <CardDescription>{pillar.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="status-card" aria-label="Performance roadmap">
        <h2>Cinematic defaults</h2>
        <ul>
          {cinematicDefaults.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <Card className="status-card" aria-label="FAQ">
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
          <CardDescription>
            Core questions for creator teams evaluating Guerilla Glass.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion>
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}
