import * as React from "react";
import type { LandingContent, StickyNavLink } from "../../content/landing";
import { CtaButton } from "./CtaButton";

type StickySectionNavProps = {
  links: LandingContent["stickySectionNav"]["links"];
  cta: LandingContent["stickySectionNav"]["cta"];
  heroSectionId: string;
};

function getActiveSection(links: readonly StickyNavLink[]) {
  const headerHeight =
    document.querySelector<HTMLElement>(".global-header")?.getBoundingClientRect().height ?? 0;
  const stickyHeight =
    document.querySelector<HTMLElement>(".sticky-section-nav")?.getBoundingClientRect().height ?? 0;
  const markerOffset = Math.max(headerHeight + stickyHeight + 24, window.innerHeight * 0.25);
  const marker = window.scrollY + markerOffset;
  let fallback = links[0]?.sectionId ?? "";

  for (const link of links) {
    const section = document.getElementById(link.sectionId);
    if (!section) {
      continue;
    }

    const sectionTop = section.offsetTop;
    const sectionBottom = sectionTop + section.offsetHeight;

    if (marker >= sectionTop) {
      fallback = link.sectionId;
    }

    if (marker >= sectionTop && marker < sectionBottom) {
      return link.sectionId;
    }
  }

  return fallback;
}

export function StickySectionNav({ links, cta, heroSectionId }: StickySectionNavProps) {
  const navRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const nav = navRef.current;
    const hero = document.getElementById(heroSectionId);

    if (!nav) {
      return;
    }

    if (!hero || typeof IntersectionObserver === "undefined") {
      nav.classList.add("is-visible");
      return;
    }

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (!entry.isIntersecting || entry.intersectionRatio < 0.1) {
          nav.classList.add("is-visible");
        } else {
          nav.classList.remove("is-visible");
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3] },
    );

    heroObserver.observe(hero);

    return () => heroObserver.disconnect();
  }, [heroSectionId]);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const applyActive = () => {
      const activeSectionId = getActiveSection(links);
      const linkNodes = nav.querySelectorAll<HTMLAnchorElement>("[data-section-id]");
      for (const linkNode of linkNodes) {
        if (linkNode.dataset.sectionId === activeSectionId) {
          linkNode.classList.add("is-active");
        } else {
          linkNode.classList.remove("is-active");
        }
      }
    };

    applyActive();

    if (typeof IntersectionObserver === "undefined") {
      window.addEventListener("scroll", applyActive, { passive: true });
      return () => {
        window.removeEventListener("scroll", applyActive);
      };
    }

    const sections = links
      .map((link) => document.getElementById(link.sectionId))
      .filter((section): section is HTMLElement => section !== null);

    const sectionObserver = new IntersectionObserver(
      () => {
        applyActive();
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    for (const section of sections) {
      sectionObserver.observe(section);
    }

    window.addEventListener("scroll", applyActive, { passive: true });

    return () => {
      sectionObserver.disconnect();
      window.removeEventListener("scroll", applyActive);
    };
  }, [links]);

  return (
    <div className="sticky-section-nav" ref={navRef}>
      <div className="sticky-section-nav-inner">
        <nav aria-label="Section navigation" className="sticky-section-links">
          {links.map((link) => (
            <a
              className="sticky-section-link"
              data-section-id={link.sectionId}
              href={`#${link.sectionId}`}
              key={link.sectionId}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <CtaButton cta={cta} className="sticky-nav-cta" section="sticky_section_nav" />
      </div>
    </div>
  );
}
