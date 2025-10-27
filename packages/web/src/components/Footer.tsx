// Quiet footer reiterating licensing and lineage without drawing too much attention.
const Footer = (): JSX.Element => (
  <footer className="site-footer">
    <p>An open project by the ARETE community.</p>
    <div className="footer-links">
      <a href="https://github.com/arete-org/arete" target="_blank" rel="noreferrer">
        <span className="link-icon">↗</span>GitHub
      </a>
      <span className="link-separator">·</span>
      <a href="https://github.com/arete-org/arete/discussions" target="_blank" rel="noreferrer">
        <span className="link-icon">↗</span>Join the discussion
      </a>
      <span className="link-separator">·</span>
      <a href="https://github.com/arete-org/arete/blob/main/PHILOSOPHY.md" target="_blank" rel="noreferrer">
        <span className="link-icon">↗</span>Philosophy
      </a>
    </div>
  </footer>
);

export default Footer;
