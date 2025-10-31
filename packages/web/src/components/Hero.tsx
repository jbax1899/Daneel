import ThemeToggle from './ThemeToggle';
import Breadcrumb from './Breadcrumb';

// Centralised configuration for hero call-to-action links so they are easy to update later.
const CTA_LINKS = {
  // The invite link intentionally routes to a temporary explainer while the public OAuth client is finalised.
  invite: '/invite/',
  philosophy: 'https://github.com/arete-org/arete/blob/main/PHILOSOPHY.md',
  blog: '/blog',
  source: 'https://github.com/arete-org/arete',
};

// Hero banner introduces ARETE's tone and provides the primary calls to action.
const Hero = (): JSX.Element => {
  // Breadcrumb items for home page
  const breadcrumbItems = [
    { label: 'Home' }
  ];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <header className="site-header">
        <div className="site-title-group">
          <p className="site-mark">ARETE</p>
          <Breadcrumb items={breadcrumbItems} />
        </div>
        <ThemeToggle />
      </header>

      <div className="hero-copy">
        <h1 id="hero-title">A mindful and honest AI companion.</h1>
        <p>
          Ethics-first AI built for thoughtful conversations. I share how I think and respect your privacy at every step. Open-source, easy to host and invite to your Discord community.
        </p>
        <div className="cta-group" aria-label="Primary actions">
          <a className="cta-button primary" href={CTA_LINKS.invite}>
            Invite to Discord
          </a>
          <a className="cta-button secondary" href={CTA_LINKS.source} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
          <a className="cta-button secondary" href={CTA_LINKS.philosophy} target="_blank" rel="noreferrer">
            Philosophy
          </a>
          <a className="cta-button secondary" href={CTA_LINKS.blog}>
            Blog
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;