import { Link } from "@tanstack/react-router";
import type { LandingCta } from "../../content/landing";
import { trackLandingEvent } from "../../lib/landing-analytics";

function mapVariant(style: LandingCta["style"]) {
  if (style === "default") {
    return "button-primary";
  }

  if (style === "outline") {
    return "button-outline";
  }

  return "button-ghost";
}

function describeHref(cta: LandingCta) {
  if (cta.type === "external") {
    return cta.href;
  }

  if (cta.to === "/workspace/$mode") {
    return `${cta.to}:${cta.params.mode}`;
  }

  return cta.to;
}

export function CtaButton({
  cta,
  className,
  section,
}: {
  cta: LandingCta;
  className?: string;
  section: string;
}) {
  const classes = ["button", mapVariant(cta.style), className].filter(Boolean).join(" ");

  const onTrackClick = () => {
    trackLandingEvent("cta_click", {
      section,
      label: cta.label,
      target: describeHref(cta),
      analyticsId: cta.analyticsId ?? null,
    });
  };

  if (cta.type === "external") {
    return (
      <a
        className={classes}
        href={cta.href}
        onClick={onTrackClick}
        rel="noreferrer"
        target="_blank"
      >
        {cta.label}
      </a>
    );
  }

  if (cta.to === "/workspace/$mode") {
    return (
      <Link className={classes} onClick={onTrackClick} params={cta.params} to={cta.to}>
        {cta.label}
      </Link>
    );
  }

  return (
    <Link className={classes} onClick={onTrackClick} to={cta.to}>
      {cta.label}
    </Link>
  );
}
