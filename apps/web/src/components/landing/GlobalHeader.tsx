import type { LandingContent } from "../../content/landing";
import { CtaButton } from "./CtaButton";

export function GlobalHeader({ globalHeader }: { globalHeader: LandingContent["globalHeader"] }) {
  return (
    <header className="global-header" role="banner">
      <div className="global-header-inner">
        <a className="global-brand" href="#overview">
          {globalHeader.brand}
        </a>
        <CtaButton cta={globalHeader.primaryCta} section="global_header" />
      </div>
    </header>
  );
}
