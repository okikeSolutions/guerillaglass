export type LandingCta = {
  label: string;
  style: "default" | "outline" | "ghost";
  analyticsId?: string;
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

export type LandingMedia = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  aspectRatio: "16 / 9" | "4 / 3" | "1 / 1";
  preload: "eager" | "lazy";
};

export type StickyNavLink = {
  label: string;
  sectionId: string;
};

export const landingContent = {
  seo: {
    title: "Guerilla Glass | Cinematic Product Walkthrough Studio",
    description:
      "Dark, premium product landing for Guerilla Glass: local-first capture, timeline editing, deterministic exports, and workflow depth.",
    keywords: [
      "guerilla glass",
      "screen recording",
      "product walkthrough",
      "deterministic export",
      "creator studio",
      "local-first video editor",
    ],
  },
  globalHeader: {
    brand: "Guerilla Glass",
    primaryCta: {
      label: "Open Workspace",
      style: "default",
      analyticsId: "global_header_open_workspace",
      type: "route",
      to: "/workspace/$mode",
      params: { mode: "capture" },
    } satisfies LandingCta,
  },
  stickySectionNav: {
    links: [
      { label: "Overview", sectionId: "overview" },
      { label: "Features", sectionId: "features" },
      { label: "Workflows", sectionId: "workflows" },
      { label: "Pricing", sectionId: "pricing" },
      { label: "FAQ", sectionId: "faq" },
    ] satisfies StickyNavLink[],
    cta: {
      label: "Start Capture",
      style: "outline",
      analyticsId: "sticky_nav_start_capture",
      type: "route",
      to: "/workspace/$mode",
      params: { mode: "capture" },
    } satisfies LandingCta,
  },
  hero: {
    sectionId: "overview",
    headline: "Create polished product walkthroughs at cinematic quality.",
    subhead:
      "Capture, edit, and deliver from one local-first workflow built for teams shipping fast and communicating clearly.",
    primaryCta: {
      label: "Download for macOS",
      style: "default",
      analyticsId: "hero_download_macos",
      type: "external",
      href: "https://github.com/okikeSolutions/guerillaglass",
    } satisfies LandingCta,
    secondaryCta: {
      label: "Open Workspace",
      style: "ghost",
      analyticsId: "hero_open_workspace",
      type: "route",
      to: "/workspace/$mode",
      params: { mode: "capture" },
    } satisfies LandingCta,
    backgroundMedia: {
      type: "image",
      src: "/landing/hero-studio.svg",
      alt: "Guerilla Glass studio surface with source capture, timeline, and delivery panels",
      aspectRatio: "16 / 9",
      preload: "eager",
    } satisfies LandingMedia,
  },
  featureSplitSections: [
    {
      sectionId: "features",
      heading: "Auto-focus attention without sacrificing control",
      body: "Camera planning tracks intent from interaction signals, then keeps transitions smooth for viewers. You can still tune every segment before export.",
      media: {
        type: "image",
        src: "/landing/split-focus.svg",
        alt: "Feature view showing automatic reframing and cursor emphasis in a product demo",
        aspectRatio: "16 / 9",
        preload: "lazy",
      } satisfies LandingMedia,
      mediaSide: "right",
      theme: "dark",
    },
    {
      sectionId: "features-timeline",
      heading: "Edit in a timeline-first layout that stays out of the way",
      body: "Trim, pacing, and framing controls stay close to the preview so editorial decisions happen quickly. The interface remains keyboard-friendly and predictable.",
      media: {
        type: "image",
        src: "/landing/split-timeline.svg",
        alt: "Timeline editing surface with transport controls and inspector adjustments",
        aspectRatio: "16 / 9",
        preload: "lazy",
      } satisfies LandingMedia,
      mediaSide: "left",
      theme: "light",
    },
  ],
  featureFullBleedSection: {
    sectionId: "feature-bleed",
    heading: "From rough capture to launch-ready deliverable",
    body: "One studio handles quick internal updates and polished external walkthroughs without tool switching.",
    media: {
      type: "image",
      src: "/landing/fullbleed-workflow.svg",
      alt: "Full-width workflow scene covering capture, editing, and export stages",
      aspectRatio: "16 / 9",
      preload: "lazy",
    } satisfies LandingMedia,
  },
  featureCardGrid: {
    sectionId: "feature-grid",
    heading: "Depth where it matters",
    body: "The core system is built to keep quality and reliability high under real production constraints.",
    cards: [
      {
        title: "Deterministic pre-encode frames",
        description:
          "Rendering output remains reproducible for the same project, version, settings, and hardware class.",
        media: {
          type: "image",
          src: "/landing/card-deterministic.svg",
          alt: "Card image representing deterministic rendering contract",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
      {
        title: "Graceful degraded capture modes",
        description:
          "If Input Monitoring is denied, recording continues while input-driven cinematic effects reduce safely.",
        media: {
          type: "image",
          src: "/landing/card-capture.svg",
          alt: "Card image representing resilient recording when some permissions are unavailable",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
      {
        title: "Review plane when teams need it",
        description:
          "Local production remains independent while cloud collaboration can layer in asynchronously.",
        media: {
          type: "image",
          src: "/landing/card-review.svg",
          alt: "Card image representing asynchronous team review and comments",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
    ],
  },
  workflowSection: {
    sectionId: "workflows",
    heading: "How Guerilla Glass fits your production stack",
    body: "Capture instantly, refine with editorial precision, then deliver in platform-ready formats while keeping one project source of truth.",
    items: [
      {
        title: "Capture",
        description: "Window/display capture with stable telemetry and low-friction startup.",
      },
      {
        title: "Edit",
        description: "Timeline + preview + inspector architecture optimized for creator velocity.",
      },
      {
        title: "Deliver",
        description: "Deterministic masters and social variants from the same workflow graph.",
      },
    ],
  },
  pricingSection: {
    sectionId: "pricing",
    heading: "Pricing designed around real usage",
    body: "Use local production freely, then adopt collaboration capabilities when your team needs shared review and governance.",
    plans: [
      {
        name: "Creator",
        price: "Free",
        description: "Local capture, edit, and export.",
        featured: false,
        cta: {
          label: "Open Workspace",
          style: "ghost",
          analyticsId: "pricing_creator_open_workspace",
          type: "route",
          to: "/workspace/$mode",
          params: { mode: "capture" },
        } satisfies LandingCta,
        bullets: [
          "Unlimited local projects",
          "Timeline and inspector workflow",
          "Cinematic defaults included",
        ],
      },
      {
        name: "Team",
        price: "Roadmap",
        description: "Review, collaboration, and operational controls.",
        featured: true,
        cta: {
          label: "View Roadmap",
          style: "default",
          analyticsId: "pricing_team_view_roadmap",
          type: "external",
          href: "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/ROADMAP.md",
        } satisfies LandingCta,
        bullets: [
          "Shared async review",
          "Team activity visibility",
          "Workflow governance controls",
        ],
      },
    ],
  },
  faqSection: {
    sectionId: "faq",
    heading: "Frequently asked questions",
    items: [
      {
        question: "Does the core workflow depend on cloud services?",
        answer:
          "No. Capture, editing, and export run locally. Cloud layers are additive for review workflows.",
      },
      {
        question: "What if Input Monitoring is not granted?",
        answer:
          "Recording continues and UI indicates reduced cinematic behavior for input-based effects.",
      },
      {
        question: "How is deterministic output defined?",
        answer:
          "The pre-encode rendering stage targets reproducible frames under equal project, version, settings, and hardware class.",
      },
      {
        question: "Can this align with multi-platform rollout plans?",
        answer:
          "Yes. macOS is production baseline with Windows and Linux parity tracks using a shared protocol contract.",
      },
    ],
  },
  footnotesSection: {
    heading: "Footnotes",
    items: [
      "Compatibility and roadmap details evolve by release phase.",
      "Screen recording permissions are managed by host operating system policy.",
      "Determinism applies to pre-encode rendering stage, not final encoded bytes.",
    ],
    legalLinks: [
      {
        label: "Specification",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/SPEC.md",
      },
      {
        label: "Roadmap",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/ROADMAP.md",
      },
      {
        label: "License",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/LICENSE",
      },
    ],
  },
  globalFooter: {
    brand: "Guerilla Glass",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/okikeSolutions/guerillaglass",
      },
      {
        label: "Convex Demo",
        href: "/anotherPage",
      },
    ],
    copyright: "© Guerilla Glass",
  },
} as const;

export type LandingContent = typeof landingContent;
