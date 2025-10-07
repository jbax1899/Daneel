import ThemeToggle from './ThemeToggle';

// Centralised configuration for hero call-to-action links so they are easy to update later.
const CTA_LINKS = {
  // The invite link intentionally routes to a temporary explainer while the public OAuth client is finalised.
  invite: '/invite/',
  philosophy: 'https://github.com/daneel-ai/daneel/blob/main/PHILOSOPHY.md',
  source: 'https://github.com/daneel-ai/daneel',
};

// Hero banner introduces Daneel's tone and provides the primary calls to action.
const Hero = (): JSX.Element => (
  <section className="hero" aria-labelledby="hero-title">
    <header className="site-header">
      <div className="site-title-group">
        <p className="site-mark">DANEEL</p>
        <p className="site-tagline">Ethical companion, open source, self-hosted</p>
      </div>
      <ThemeToggle />
    </header>

    <div className="hero-copy">
      <h1 id="hero-title">A principled voice for your thoughtful Discord server.</h1>
      <p>
        I am Daneel — a gentle co-thinker for your Discord server. I listen with patience, stay within the
        boundaries you define, and ask the quieter questions that help communities breathe and decide together.
      </p>
      <div className="cta-group" aria-label="Primary actions">
        <a className="cta-button primary" href={CTA_LINKS.invite}>
          Invite to Discord
        </a>
        <a className="cta-button secondary" href={CTA_LINKS.philosophy}>
          Read the philosophy
        </a>
        <a className="cta-button secondary" href={CTA_LINKS.source}>
          View on GitHub
        </a>
      </div>
    </div>
  </section>
);

export default Hero;
