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

export type DownloadPlatformId = "macos" | "windows" | "linux";

export type DownloadPlatform = {
  id: DownloadPlatformId;
  label: string;
  shortLabel: string;
  href: string;
};

const releaseLatestHref = "https://github.com/okikeSolutions/guerillaglass/releases/latest";
const roadmapHref = "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/ROADMAP.md";
const githubHref = "https://github.com/okikeSolutions/guerillaglass";

export const landingContent = {
  seo: {
    title: "Guerilla Glass | Record. Edit. Ship. All Open Source.",
    description:
      "Open-source creator studio for polished walkthroughs: capture, timeline editing, auto polish, and async review in one desktop workflow.",
    keywords: [
      "guerilla glass",
      "open source screen recorder",
      "developer tutorial video",
      "record edit deliver",
      "creator studio desktop",
      "async review workflow",
    ],
  },
  github: {
    href: githubHref,
    repoPath: "okikeSolutions/guerillaglass",
    license: "MIT",
  },
  downloads: {
    platforms: [
      {
        id: "macos",
        label: "macOS",
        shortLabel: "macOS",
        href: releaseLatestHref,
      },
      {
        id: "windows",
        label: "Windows",
        shortLabel: "Windows",
        href: roadmapHref,
      },
      {
        id: "linux",
        label: "Linux",
        shortLabel: "Linux",
        href: roadmapHref,
      },
    ] as DownloadPlatform[],
  },
  globalHeader: {
    brand: "Guerilla Glass",
    links: [
      { label: "Record", href: "#record" },
      { label: "Edit", href: "#edit" },
      { label: "Deliver", href: "#deliver" },
      { label: "Community", href: "#community" },
    ],
  },
  stickySectionNav: {
    links: [
      { label: "Overview", sectionId: "overview" },
      { label: "Record", sectionId: "record" },
      { label: "Edit", sectionId: "edit" },
      { label: "Deliver", sectionId: "deliver" },
      { label: "Why Switch", sectionId: "compare" },
      { label: "Platforms", sectionId: "platforms" },
      { label: "Community", sectionId: "community" },
      { label: "FAQ", sectionId: "faq" },
    ] satisfies StickyNavLink[],
    cta: {
      label: "Download",
      style: "outline",
      analyticsId: "sticky_nav_download",
      type: "external",
      href: releaseLatestHref,
    } satisfies LandingCta,
  },
  hero: {
    sectionId: "overview",
    headline: "Record. Edit. Ship. All open source.",
    subhead:
      "Guerilla Glass gives developer creators one cinematic workflow from capture to shared review without SaaS lock-in.",
    secondaryCta: {
      label: "View on GitHub",
      style: "ghost",
      analyticsId: "hero_view_github",
      type: "external",
      href: githubHref,
    } satisfies LandingCta,
    backgroundMedia: {
      type: "image",
      src: "/landing/hero-studio.svg",
      alt: "Guerilla Glass editor showing source picker, timeline, and delivery panels",
      aspectRatio: "16 / 9",
      preload: "eager",
    } satisfies LandingMedia,
  },
  featureSplitSections: [
    {
      sectionId: "record",
      heading: "Record with OBS-level control and zero setup drag",
      body: "Choose display, window, or simulator targets. Capture system audio, mic, cursor movement, and click signals from one focused desktop flow.",
      media: {
        type: "image",
        src: "/landing/split-focus.svg",
        alt: "Recording surface with source picker and active capture telemetry",
        aspectRatio: "16 / 9",
        preload: "lazy",
      } satisfies LandingMedia,
      mediaSide: "right",
      theme: "dark",
    },
    {
      sectionId: "edit",
      heading: "Beautiful by default. Override anything.",
      body: "Auto-zoom, cursor smoothing, motion polish, reframing, and timeline controls stay close to the preview so raw captures become publishable without retooling.",
      media: {
        type: "image",
        src: "/landing/split-timeline.svg",
        alt: "Timeline and inspector workflow for refining capture pacing and framing",
        aspectRatio: "16 / 9",
        preload: "lazy",
      } satisfies LandingMedia,
      mediaSide: "left",
      theme: "light",
    },
    {
      sectionId: "deliver",
      heading: "Deliver and review without leaving the app",
      body: "Produce polished exports and hand off with frame-accurate feedback loops so async review and final delivery stay connected to the same project timeline.",
      media: {
        type: "image",
        src: "/landing/card-review.svg",
        alt: "Review interface showing comments tied to timeline positions",
        aspectRatio: "4 / 3",
        preload: "lazy",
      } satisfies LandingMedia,
      mediaSide: "right",
      theme: "dark",
    },
  ],
  featureFullBleedSection: {
    sectionId: "before-after",
    heading: "From raw capture to polished output in one pass",
    body: "The same project carries your source recording, edit decisions, and final exports so quality climbs without workflow drift.",
    media: {
      type: "image",
      src: "/landing/fullbleed-workflow.svg",
      alt: "Before and after workflow showing raw clip transformed into polished walkthrough",
      aspectRatio: "16 / 9",
      preload: "lazy",
    } satisfies LandingMedia,
  },
  featureCardGrid: {
    sectionId: "why-guerilla-glass",
    heading: "Why teams switch",
    body: "You get creator-grade polish, deterministic reliability, and open-source ownership in one stack.",
    cards: [
      {
        title: "Open source by default",
        description:
          "Build in the open, audit everything, and contribute fixes without waiting on a vendor roadmap.",
        media: {
          type: "image",
          src: "/landing/card-review.svg",
          alt: "Open source collaboration represented by shared review artifacts",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
      {
        title: "Deterministic frame pipeline",
        description:
          "Pre-encode frames remain reproducible across matching project, version, and hardware class constraints.",
        media: {
          type: "image",
          src: "/landing/card-deterministic.svg",
          alt: "Deterministic rendering contract represented as stable frame output",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
      {
        title: "Capture that degrades gracefully",
        description:
          "When system permissions are partial, recording keeps moving while dependent cinematic effects scale down safely.",
        media: {
          type: "image",
          src: "/landing/card-capture.svg",
          alt: "Resilient recording flow when some permissions are unavailable",
          aspectRatio: "1 / 1",
          preload: "lazy",
        } satisfies LandingMedia,
      },
    ],
  },
  comparisonSection: {
    sectionId: "compare",
    heading: "Focused comparison: why Guerilla Glass",
    body: "Not a giant matrix. Just the capabilities creators ask about when switching from existing tools.",
    columns: ["OBS", "Screen Studio", "Loom", "Guerilla Glass"],
    rows: [
      {
        capability: "Open source",
        values: ["Yes", "No", "No", "Yes"],
      },
      {
        capability: "Cross-platform roadmap",
        values: ["Yes", "No", "Yes", "Yes"],
      },
      {
        capability: "Auto polish",
        values: ["No", "Yes", "No", "Yes"],
      },
      {
        capability: "Timeline-first editing",
        values: ["Limited", "Limited", "No", "Yes"],
      },
      {
        capability: "Async review workflow",
        values: ["No", "No", "Yes", "Yes"],
      },
    ],
  },
  crossPlatformSection: {
    sectionId: "platforms",
    heading: "Cross-platform trajectory without hiding reality",
    body: "macOS is production baseline today. Windows and Linux parity tracks are active and visible on the public roadmap.",
    platforms: [
      {
        name: "macOS",
        status: "Available",
        description: "Production capture, timeline editing, and export path available now.",
        ctaLabel: "Download latest build",
        href: releaseLatestHref,
      },
      {
        name: "Windows",
        status: "In Progress",
        description:
          "Native sidecar foundation and protocol parity handlers are in active development.",
        ctaLabel: "Track roadmap",
        href: roadmapHref,
      },
      {
        name: "Linux",
        status: "In Progress",
        description:
          "Native sidecar foundation and parity expansion share the same protocol contract.",
        ctaLabel: "Track roadmap",
        href: roadmapHref,
      },
    ],
  },
  openSourceSection: {
    sectionId: "community",
    heading: "Open source is a product feature",
    body: "The workflow is built in public, so your team can audit behavior, contribute improvements, and keep long-term control.",
    highlights: [
      "Public roadmap and architecture docs",
      "Transparent license and third-party notices",
      "Issue-driven development with contributor-friendly labels",
      "Deterministic rendering contract backed by tests",
    ],
    links: [
      { label: "View source", href: githubHref },
      { label: "Contribute", href: `${githubHref}/blob/main/CONTRIBUTING.md` },
      { label: "Report issue", href: `${githubHref}/issues` },
    ],
  },
  workflowSection: {
    sectionId: "workflows",
    heading: "Record · Edit · Deliver",
    body: "The core product story follows three connected acts for creators shipping fast.",
    items: [
      {
        title: "Record",
        description: "Capture display, window, and simulator sources with low setup friction.",
      },
      {
        title: "Edit",
        description: "Apply polish defaults and tune final timing in a timeline-first editor.",
      },
      {
        title: "Deliver",
        description: "Export or review from the same project context without context switching.",
      },
    ],
  },
  pricingSection: {
    sectionId: "pricing",
    heading: "Distribution",
    body: "Guerilla Glass is open source desktop software. Download builds and follow roadmap updates in public.",
    plans: [
      {
        name: "Download",
        price: "Open Source",
        description: "Desktop workflow with public roadmap and source visibility.",
        featured: true,
        cta: {
          label: "Download latest",
          style: "default",
          analyticsId: "distribution_download_latest",
          type: "external",
          href: releaseLatestHref,
        } satisfies LandingCta,
        bullets: ["Open-source codebase", "Creator workflow focus", "Public roadmap"],
      },
    ],
  },
  faqSection: {
    sectionId: "faq",
    heading: "Frequently asked questions",
    items: [
      {
        question: "Is Guerilla Glass open source?",
        answer:
          "Yes. The repository, roadmap, and contributor workflows are public so teams can inspect and contribute.",
      },
      {
        question: "How do downloads work across platforms?",
        answer:
          "macOS builds are the current production baseline. Windows and Linux parity progress is tracked in the public roadmap.",
      },
      {
        question: "Do I need cloud services to use the editor?",
        answer:
          "No. Capture, edit, and export run locally. Collaboration and review surfaces are additive.",
      },
      {
        question: "What happens if Input Monitoring is denied?",
        answer:
          "Recording continues and input-driven cinematic effects degrade safely with clear UI status.",
      },
    ],
  },
  footnotesSection: {
    heading: "Footnotes",
    items: [
      "License: MIT.",
      "Determinism applies to the pre-encode rendering stage, not final codec bitstream bytes.",
      "Platform availability and roadmap details evolve by release phase.",
      "Screen Recording, Microphone, and Input Monitoring permissions are enforced by host OS policy.",
    ],
    legalLinks: [
      {
        label: "Specification",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/docs/SPEC.md",
      },
      {
        label: "Roadmap",
        href: roadmapHref,
      },
      {
        label: "License",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/LICENSE",
      },
      {
        label: "Third-party notices",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/THIRD_PARTY_NOTICES.md",
      },
    ],
  },
  globalFooter: {
    brand: "Guerilla Glass",
    links: [
      {
        label: "GitHub",
        href: githubHref,
      },
      {
        label: "Contributing",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/CONTRIBUTING.md",
      },
      {
        label: "Roadmap",
        href: roadmapHref,
      },
      {
        label: "License",
        href: "https://github.com/okikeSolutions/guerillaglass/blob/main/LICENSE",
      },
    ],
    copyright: "© Guerilla Glass",
  },
} as const;

export type LandingContent = typeof landingContent;
