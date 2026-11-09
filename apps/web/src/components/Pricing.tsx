import * as m from "../paraglide/messages.js";

// Keep the existing export name for callers; there are no purchasable plans yet.
export const ProductPacks = () => (
  <section className="site-section site-open" aria-labelledby="open-title">
    <h2 id="open-title">{m.web_ui_open_title()}</h2>
    <div>
      <p>{m.web_ui_open_body()}</p>
      <div className="site-actions">
        <a
          className="site-text-link"
          href="https://github.com/okikeSolutions/guerillaglass#quick-start"
        >
          {m.web_ui_setup()} <span aria-hidden="true">↗</span>
        </a>
        <a className="site-text-link" href="https://github.com/okikeSolutions/guerillaglass/issues">
          {m.web_ui_issues()} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>
);
