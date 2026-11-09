import { createFileRoute } from "@tanstack/react-router";
import * as m from "../paraglide/messages.js";
import { Footer } from "../components/Footer";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  return (
    <div className="public-site">
      <header className="site-header">
        <a className="site-brand" href="/">
          Guerilla Glass
        </a>
        <a className="site-text-link" href="/">
          {m.web_ui_back()}
        </a>
      </header>
      <main className="site-section site-prose">
        <h1>{m.web_ui_about_title()}</h1>
        <p>{m.web_ui_about_body()}</p>
        <a
          className="site-button"
          href="https://github.com/okikeSolutions/guerillaglass#quick-start"
        >
          {m.web_ui_setup()}
        </a>
      </main>
      <Footer />
    </div>
  );
}
