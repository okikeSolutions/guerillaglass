import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const workflowPillars = [
  {
    title: "Capture Stays Native",
    detail:
      "Mac, Windows, and Linux engines stay local-first for deterministic rendering and low-latency recording.",
  },
  {
    title: "Edit Feels Fast",
    detail:
      "Timeline and preview are first-class surfaces with cinematic defaults and keyboard-first control.",
  },
  {
    title: "Review Scales in Cloud",
    detail:
      "Convex powers link sharing, comments, presence, and webhook-based playback readiness in Deliver.",
  },
  {
    title: "Deliver with Entitlements",
    detail:
      "Paid collaboration is enforced server-side while local capture/edit/export remains available.",
  },
] as const;

const performanceReferences = [
  "Intent prewarm for likely review routes (hover/focus/touch).",
  "Media preconnect and manifest warmup for smoother playback startup.",
  "Reactive comment/presence updates with server-side authorization checks.",
  "Fallback playback policy: processed stream first, original source when needed.",
] as const;

function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <p className="eyebrow">Guerilla Glass</p>
        <h1>Native Capture, High-Performance Review.</h1>
        <p className="hero-copy">
          We keep recording and editing local for quality and determinism, then layer in Convex for
          async review, collaboration, and commercialization.
        </p>
        <div className="hero-actions">
          <a
            className="button button-primary"
            href="https://github.com/okikeSolutions/guerillaglass"
            rel="noreferrer"
            target="_blank"
          >
            View Repository
          </a>
          <Link className="button button-primary" to="/workspace/capture">
            Open Workspace
          </Link>
          <Link className="button button-ghost" to="/anotherPage">
            Open Convex Demo Route
          </Link>
        </div>
      </section>

      <section className="pillar-grid" aria-label="Workflow pillars">
        {workflowPillars.map((pillar) => (
          <article className="pillar-card" key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p>{pillar.detail}</p>
          </article>
        ))}
      </section>

      <section className="status-card" aria-label="Performance roadmap">
        <h2>Fast-by-default roadmap alignment</h2>
        <ul>
          {performanceReferences.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
