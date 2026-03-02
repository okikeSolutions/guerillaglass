# Design Spec — Product Landing Page

> A long-form scrollytelling product landing page that uses large visuals
> and short copy to walk users through key benefits and features. The
> primary CTA is always easy to find (hero + sticky nav), with deeper
> sections (pricing, FAQ, footnotes) at the end.

---

## 1. Visual Direction

### Tone

| Axis              | Position                                              |
| ----------------- | ----------------------------------------------------- |
| Light ↔ Dark      | Dark-dominant — dark backgrounds, light text, vibrant product media |
| Dense ↔ Spacious  | Spacious — generous whitespace, content breathes      |
| Loud ↔ Quiet      | Quiet — visuals do the talking, UI stays out of the way |
| Playful ↔ Serious | Confident and serious, not corporate or stiff         |
| Flat ↔ Depth      | Subtle depth — soft layering, no heavy skeuomorphism  |

### Color

```text
Backgrounds
  Primary:         #000 or near-black (#0a0a0a)  — hero + feature sections
  Contrast break:  #f5f5f7                        — used sparingly between dark sections

Text
  On dark:         #ffffff
  On light:        #1d1d1f
  Secondary/muted: rgba(255,255,255,0.7) on dark, rgba(0,0,0,0.55) on light

Accent
  One brand color for CTAs and interactive highlights.
  All other color comes from the product visuals themselves.

Borders / dividers
  Subtle only — rgba(255,255,255,0.1) on dark, rgba(0,0,0,0.08) on light
```

### Typography

```text
Font family:       One geometric or grotesque sans-serif (e.g., Inter,
                   Instrument Sans, SF Pro). Max two families total.

Scale
  H1 (hero):       clamp(40px, 5vw, 72px)   — bold or black, tracking -0.02em
  H2 (section):    clamp(32px, 4vw, 48px)    — bold, tracking -0.015em
  H3 (feature):    clamp(22px, 2.5vw, 30px)  — semibold
  Body:            16–18px, regular, line-height 1.5–1.6
  Caption/label:   13–14px, medium, uppercase tracking 0.05em (sparingly)

Max line length:   ~65ch for prose blocks
```

### Spacing & Rhythm

```text
Base unit:                  8px — all spacing is a multiple (16, 24, 32, 48, 64, 80, 120)

Section vertical padding
  Desktop:                  120–160px
  Mobile:                   80–100px

Gap between elements
  Heading → body:           16–24px
  Body → CTA:               32–40px
  Cards in a grid:          24–32px

Content max-width
  Prose/copy blocks:        680–720px (centered)
  Full layout container:    1200–1440px
```

### Media & Imagery

```text
- Product visuals shown in-context (on device, in a workflow) — not floating screenshots
- Minimum visual height: 50vh on desktop
- Prefer short video loops (5–15s, muted autoplay) over static images where possible
- All media sits on dark/neutral backgrounds, edge-to-edge bleed
- No stock photography, no generic illustrations
- Aspect ratios: 16:9 for hero/cinematic, 4:3 or 1:1 for cards
- Formats: WebP/AVIF with JPEG fallback; MP4 (H.264) for video
- Max file size per video: ~4 MB (above the fold), ~8 MB (below)
- Every video has a poster frame; every image has meaningful alt text
```

### Animation

```text
Easing:            ease-out  or  cubic-bezier(0.25, 0.1, 0.25, 1)
Duration:          200–500ms — nothing over 700ms
Reveal pattern:    fade-in + translateY(20–30px), elements rise into place
Stagger:           50–100ms delay between sibling elements (e.g., cards)
Scroll trigger:    IntersectionObserver — fire once when element enters viewport

DO:    subtle fades, gentle slides, opacity transitions
DON'T: parallax, bounce, elastic easing, spinning, 3D transforms,
       anything that draws attention to itself

Reduced motion:    Respect prefers-reduced-motion — disable transforms,
                   keep opacity fades only or skip animations entirely.
```

---

## 2. Page Structure

```text
┌─────────────────────────────────────┐
│  Global Header                      │
├─────────────────────────────────────┤
│  Hero                               │
│    Headline + subhead               │
│    Primary CTA / secondary CTA      │
│    Large product visual or video    │
├─────────────────────────────────────┤
│  Sticky Section Nav (anchor links)  │
│    Overview · Features · Workflows  │
│    · Pricing · FAQ                  │
├─────────────────────────────────────┤
│  Feature Story Sections (repeat)    │
│    — FeatureSplitSection            │
│    — FeatureFullBleedSection        │
│    — FeatureCardGrid                │
├─────────────────────────────────────┤
│  Workflow / Ecosystem Section       │
│    How it fits into broader stack   │
├─────────────────────────────────────┤
│  Pricing / Plans                    │
├─────────────────────────────────────┤
│  FAQ (accordion)                    │
├─────────────────────────────────────┤
│  Footnotes / Requirements / Legal   │
├─────────────────────────────────────┤
│  Global Footer                      │
└─────────────────────────────────────┘
```

---

## 3. Components

All components are reusable and data-driven (JSON, MDX, or CMS schema)
so marketing can reorder, add, or remove sections without code changes.

### `Hero`

| Prop             | Type                  | Notes                                    |
| ---------------- | --------------------- | ---------------------------------------- |
| headline         | string                | 1 line preferred, 2 max                  |
| subhead          | string                | 1–2 short sentences                      |
| primaryCTA       | { label, href }       | Always visible                           |
| secondaryCTA     | { label, href }?      | Optional                                 |
| backgroundMedia  | image \| video        | Full-bleed, dark, poster required for video |

### `StickySectionNav`

- Anchors to page sections by ID.
- Highlights active section on scroll (IntersectionObserver).
- Desktop: horizontal bar pinned below header.
- Mobile: horizontally scrollable row or collapsed dropdown.
- Keyboard navigable, visible focus ring.

### `FeatureSplitSection`

| Prop       | Type             | Notes                                   |
| ---------- | ---------------- | --------------------------------------- |
| heading    | string           |                                         |
| body       | string \| MDX    |                                         |
| media      | image \| video   |                                         |
| mediaside  | `left` \| `right`| Alternates per section                  |
| theme      | `dark` \| `light`| Controls background + text color        |

- Copy and media sit side-by-side on desktop, stack on mobile (media on top).

### `FeatureFullBleedSection`

- Large background visual (≥ 80vh).
- Minimal overlay copy (heading + 1 sentence) positioned bottom-left or centered.
- Dark scrim behind text if needed for readability.

### `FeatureCardGrid`

- 3–6 cards in a responsive grid (3 cols desktop, 2 tablet, 1 mobile).
- Each card: icon/thumbnail + heading + short description.
- Uniform card height per row.

### `PricingSection`

- Plan cards or comparison table.
- Highlight recommended plan.
- CTA per plan.

### `FAQAccordion`

- Single-expand or multi-expand (decide during build).
- Smooth height transition on open/close.
- Semantic `<details>`/`<summary>` or equivalent with ARIA.

### `FootnotesSection`

- Small text, muted color, legal links.

---

## 4. Interactions

| Interaction                  | Detail                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| Anchor scroll                | Smooth scroll from sticky nav to section (`scroll-behavior: smooth` or JS) |
| Active section tracking      | IntersectionObserver updates nav highlight as user scrolls     |
| Scroll-triggered reveals     | Fade + rise on first enter; trigger once, don't replay        |
| Sticky nav                   | Pins below global header; visible after user scrolls past hero |
| Inline video                 | Autoplay muted, loop, poster fallback, pause when out of view |
| Reduced motion               | All transforms disabled; opacity-only or instant              |

---

## 5. Responsive Behavior

| Breakpoint   | Width   | Notes                                               |
| ------------ | ------- | --------------------------------------------------- |
| Mobile       | < 768   | Single column, media stacks above copy, nav scrolls horizontally |
| Tablet       | 768–1024| Two-column where possible, spacing scales down      |
| Desktop      | > 1024  | Full layouts as designed                             |
| Large        | > 1440  | Content max-width caps; backgrounds still bleed      |

Non-negotiables:
- Typography and spacing scale cleanly — no cramped copy.
- Media keeps correct aspect ratio and never causes layout shift.
- Touch targets ≥ 44 × 44px on mobile.
- Sticky nav remains usable on all sizes.

---

## 6. Performance

```text
- Images:   WebP/AVIF, responsive srcset, lazy-load below the fold
- Video:    Compressed MP4, poster frame, lazy-load, pause off-screen
- JS:       Minimal — IntersectionObserver for scroll logic, no heavy
            scroll listeners, no layout thrashing
- Fonts:    Subset + swap, max 2 families, ≤ 4 weights total
- CLS:      Reserve explicit dimensions for all media (no layout jumps)
- LCP:      Hero image/video preloaded; target < 2.5s
```

---

## 7. Accessibility

```text
- Semantic heading hierarchy (one H1, H2 per section, etc.)
- All images have descriptive alt text; decorative images use alt=""
- Keyboard navigation works end-to-end (nav, CTAs, accordion, links)
- Visible focus states on all interactive elements
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text
- prefers-reduced-motion respected
- FAQ accordion uses proper ARIA roles or native <details>
- Skip-to-content link
```

---

## 8. References

Take **specific qualities** from each — do not clone any of them.

| Reference               | What to take                                              |
| ------------------------ | --------------------------------------------------------- |
| apple.com/final-cut-pro  | Section pacing, dark cinematic feel, visual dominance over copy |
| linear.app               | Typography confidence, sticky nav behavior, dark palette  |
| stripe.com/payments      | Content structure, card grids, explaining complexity simply |
| vercel.com               | Animation subtlety, clean component design                |

**Avoid:**
- Hero carousels / sliders
- Gradient mesh or abstract blob backgrounds
- More than 2 CTAs visible at any time
- Walls of text in feature sections

---

## 9. Definition of Done

- [ ] Hero + one FeatureSplitSection built and **reviewed before** continuing
      (design checkpoint — catch direction issues early)
- [ ] Sticky nav visible, pinned correctly, highlights active section
- [ ] All sections built from reusable, data-driven templates
- [ ] Mobile layout is clean, usable, and tested on real devices
- [ ] Animations are subtle, performant, and disabled for reduced-motion
- [ ] All media optimized (lazy-loaded, correct formats, no layout shift)
- [ ] Accessibility audit passes (headings, alt text, keyboard, contrast)
- [ ] CTA click events tracked
- [ ] Basic scroll depth tracking in place
- [ ] Cross-browser tested: last 2 versions of Chrome, Firefox, Safari,
      Edge; iOS Safari 16+