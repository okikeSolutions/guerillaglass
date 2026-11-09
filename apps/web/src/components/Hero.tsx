import * as m from "../paraglide/messages.js";
import MotionDrawer from "./motion-drawer";
import { FaqInteractivePreview } from "./FAQ";
import { FeatureBento } from "./Features";
import { Footer } from "./Footer";
import { ProductPacks } from "./Pricing";

export const sourceUrl = "https://github.com/okikeSolutions/guerillaglass";
export const setupUrl = `${sourceUrl}#quick-start`;

export const Hero = () => (
  <div className="public-site">
    <a className="site-skip" href="#content">
      {m.web_ui_skip()}
    </a>
    <header className="site-header">
      <a className="site-brand" href="/">
        Guerilla Glass
      </a>
      <nav className="site-desktop-nav" aria-label={m.web_ui_menu_title()}>
        <a href="#product">{m.web_ui_nav_product()}</a>
        <a href="#faq">{m.web_ui_nav_faq()}</a>
        <a href={sourceUrl}>{m.web_ui_nav_source()}</a>
      </nav>
      <div className="site-mobile-nav">
        <MotionDrawer>
          <nav aria-label={m.web_ui_menu_title()}>
            <a href="#product">{m.web_ui_nav_product()}</a>
            <a href="#faq">{m.web_ui_nav_faq()}</a>
            <a href={sourceUrl}>{m.web_ui_nav_source()}</a>
            <a href="/about">{m.web_ui_nav_about()}</a>
          </nav>
        </MotionDrawer>
      </div>
    </header>
    <main id="content">
      <section className="site-hero" aria-labelledby="hero-title">
        <div className="site-hero-copy">
          <p className="site-eyebrow">{m.web_ui_eyebrow()}</p>
          <h1 id="hero-title">{m.web_ui_headline()}</h1>
          <p className="site-intro">{m.web_ui_intro()}</p>
          <div className="site-actions">
            <a className="site-button" href={setupUrl}>
              {m.web_ui_build()}
            </a>
            <a className="site-text-link" href="#product">
              {m.web_ui_see_workflow()} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="site-note">{m.web_ui_build_note()}</p>
        </div>
        <figure className="site-preview">
          <img
            src="/studio-preview.png"
            width="1320"
            height="892"
            alt={m.web_ui_preview_alt()}
            fetchPriority="high"
          />
          <figcaption>{m.web_ui_preview_caption()}</figcaption>
        </figure>
      </section>
      <FeatureBento />
      <section className="site-section" aria-labelledby="demo-title">
        <h2 id="demo-title">{m.web_ui_demo_title()}</h2>
        <p id="demo-description" className="site-intro">
          {m.web_ui_demo_description()}
        </p>
        <video
          className="site-demo"
          src="/demo.mp4"
          poster="/demo-poster.jpg"
          controls
          playsInline
          preload="none"
          aria-label={m.web_ui_demo_label()}
          aria-describedby="demo-description"
        />
      </section>
      <ProductPacks />
      <FaqInteractivePreview />
    </main>
    <Footer />
  </div>
);
