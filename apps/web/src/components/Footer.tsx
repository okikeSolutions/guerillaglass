import * as m from "../paraglide/messages.js";

export const Footer = () => (
  <footer className="site-footer">
    <div>
      <a className="site-brand" href="/">
        Guerilla Glass
      </a>
      <p>{m.web_ui_footer_note()}</p>
    </div>
    <nav aria-label={m.web_ui_nav_about()}>
      <a href="/about">{m.web_ui_nav_about()}</a>
      <a href="https://github.com/okikeSolutions/guerillaglass">{m.web_ui_nav_source()}</a>
      <a href="https://github.com/okikeSolutions/guerillaglass#quick-start">{m.web_ui_setup()}</a>
    </nav>
  </footer>
);
