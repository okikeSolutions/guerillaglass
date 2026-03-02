export type LandingCta = {
  label: string;
  style: "default" | "outline" | "ghost";
} & (
  | {
      type: "external";
      href: string;
    }
  | {
      type: "route";
      to: "/workspace/$mode";
      params: {
        mode: "capture" | "edit" | "deliver";
      };
    }
  | {
      type: "route";
      to: "/" | "/anotherPage";
    }
);

export const landingContent = {
  seo: {
    title: "Guerilla Glass | Record. Edit. Deliver.",
    description:
      "Open-source creator studio with local-first capture/edit, deterministic export, and cinematic defaults.",
    keywords: [
      "screen recorder",
      "video editor",
      "deterministic export",
      "auto zoom",
      "cursor smoothing",
      "local-first",
      "cross-platform",
    ],
  },
  hero: {
    eyebrow: "Guerilla Glass",
    title: "Record. Edit. Deliver. Cinematic by default.",
    copy: "Built for creators who want native capture discipline, editor-first control, and polished outputs without cloud lock-in.",
    badges: ["Local-first", "Editor-first", "Deterministic exports"],
    ctas: [
      {
        label: "Download for macOS",
        style: "default",
        type: "external",
        href: "https://github.com/okikeSolutions/guerillaglass",
      },
      {
        label: "Open Workspace",
        style: "outline",
        type: "route",
        to: "/workspace/$mode",
        params: { mode: "capture" },
      },
    ] satisfies LandingCta[],
  },
  workflow: {
    title: "Workflow",
    intro: "One studio from first take to final delivery.",
    items: [
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
    ],
  },
  cinematicDemos: {
    title: "Cinematic Defaults",
    intro: "Visual polish is automatic, then still editable when you need precision.",
    items: [
      {
        title: "Auto-zoom and reframing",
        detail: "Keep focus on intent without hand-keyframing every move.",
      },
      {
        title: "Cursor smoothing and click emphasis",
        detail: "Clearer guidance for viewers on fast UI walkthroughs.",
      },
      {
        title: "Motion blur and camera motion",
        detail: "Natural movement that feels edited, not raw.",
      },
      {
        title: "Vertical export with re-planned framing",
        detail: "Render social-ready formats without manual recuts.",
      },
    ],
  },
  trust: {
    title: "Trust by design",
    intro: "Operational reliability and privacy are defaults, not add-ons.",
    items: [
      "Local capture/edit/export works offline.",
      "Cloud review is additive and cannot block local production.",
      "If Input Monitoring is denied, recording continues with degraded cinematic features.",
      "Determinism contract targets reproducible pre-encode frame output.",
    ],
  },
  platformParity: {
    title: "Platform parity",
    intro: "macOS is production baseline; Windows/Linux parity follows the same protocol contract.",
    rows: [
      { platform: "macOS", status: "Production baseline", note: "Capture + edit + export" },
      { platform: "Windows", status: "Native parity track", note: "Rust sidecar expansion" },
      { platform: "Linux", status: "Native parity track", note: "Rust sidecar expansion" },
    ],
  },
  pricingOrWaitlist: {
    title: "Commercial model",
    intro:
      "Core creator workflow remains local-first. Collaboration and cloud review are the commercialization plane.",
    primaryCta: {
      label: "View roadmap",
      style: "outline",
      type: "external",
      href: "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/ROADMAP.md",
    } satisfies LandingCta,
  },
  faq: {
    title: "FAQ",
    items: [
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
    ],
  },
  finalCta: {
    title: "Ship better walkthroughs with less manual polish.",
    copy: "Start in Capture, refine in Edit, and deliver with deterministic confidence.",
    primary: {
      label: "Open Workspace",
      style: "default",
      type: "route",
      to: "/workspace/$mode",
      params: { mode: "capture" },
    } satisfies LandingCta,
    secondary: {
      label: "Convex demo route",
      style: "ghost",
      type: "route",
      to: "/anotherPage",
    } satisfies LandingCta,
  },
} as const;

export type LandingContent = typeof landingContent;
