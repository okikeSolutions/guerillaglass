import { Link } from "@tanstack/react-router";
import type { LandingContent } from "../../content/landing";

export function GlobalFooter({ footer }: { footer: LandingContent["globalFooter"] }) {
  return (
    <footer className="global-footer" role="contentinfo">
      <div className="global-footer-inner">
        <p className="global-footer-brand">{footer.brand}</p>
        <nav aria-label="Footer links" className="global-footer-links">
          {footer.links.map((link) => {
            if (link.href.startsWith("/")) {
              return (
                <Link
                  className="global-footer-link"
                  key={link.label}
                  to={link.href as "/anotherPage" | "/"}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <a
                className="global-footer-link"
                href={link.href}
                key={link.label}
                rel="noreferrer"
                target="_blank"
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
      <p className="global-footer-copy">{footer.copyright}</p>
    </footer>
  );
}
