// Quiet footer reiterating licensing and lineage without drawing too much attention.
const Footer = (): JSX.Element => (
  <footer className="site-footer">
    <p>Crafted in the open. Inspired — with gratitude — by Isaac Asimov&apos;s R. Daneel Olivaw.</p>
    <details>
      <summary>License &amp; Source</summary>
      <ul className="footer-menu">
        <li>
          <a href="https://github.com/daneel-ai/daneel" target="_blank" rel="noreferrer">
            View source on GitHub
          </a>
        </li>
        <li>
          <a href="/LICENSE" target="_blank" rel="noreferrer">
            MIT License
          </a>
        </li>
      </ul>
    </details>
  </footer>
);

export default Footer;
