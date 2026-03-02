import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@guerillaglass/ui/ui/button";
import { cn } from "@guerillaglass/ui/lib/utils";
import type { LandingCta } from "../../content/landing";

export function CtaButton({ cta, className }: { cta: LandingCta; className?: string }) {
  const classes = cn(buttonVariants({ size: "lg", variant: cta.style }), "button", className);

  if (cta.type === "external") {
    return (
      <a className={classes} href={cta.href} rel="noreferrer" target="_blank">
        {cta.label}
      </a>
    );
  }

  if (cta.to === "/workspace/$mode") {
    return (
      <Link className={classes} params={cta.params} to={cta.to}>
        {cta.label}
      </Link>
    );
  }

  return (
    <Link className={classes} to={cta.to}>
      {cta.label}
    </Link>
  );
}
