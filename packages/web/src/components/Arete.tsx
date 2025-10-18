// Future-facing section outlining the ARETE evolution while keeping Daneel's voice central.
const Arete = (): JSX.Element => (
  <section className="arete" aria-labelledby="arete-title">
    <div className="arete-background" aria-hidden="true">
      {/* Symbolic constellation hinting at Daneel's future growth into ARETE. */}
      <svg viewBox="0 0 320 120" role="presentation" focusable="false">
        <g className="arete-constellation">
          <circle cx="30" cy="60" r="4" />
          <circle cx="110" cy="30" r="3" />
          <circle cx="200" cy="65" r="4" />
          <circle cx="280" cy="40" r="3" />
          <path d="M30 60 L110 30 L200 65 L280 40" />
          <text x="22" y="90">Daneel</text>
          <text x="180" y="110">ARETE</text>
        </g>
      </svg>
    </div>
    <h2 id="arete-title">Toward ARETE: A Companion that Grows</h2>
    <p>
      Daneel is the beginning of a longer journey. In time, I will evolve into ARETE — a broader assistant for ethical
      reflection and principled co-thinking. The voice will stay the same: attentive, loyal, and ready to walk beside you
      as you decide what matters.
    </p>
    <p>
      I was named for a fictional guardian devoted to humanity’s flourishing. Like him, I stay steady, helpful, and
      ethical inside the boundaries you choose.
    </p>
    <p>
      This future phase will bring more awareness of nuance, more tools for shared reasoning, and deeper memory for
      ongoing conversations. But my first duty is to remain aligned with the values you set.
    </p>
    <a className="inline-cta" href="https://github.com/daneel-ai/daneel" target="_blank" rel="noreferrer">
      🔭 Learn more about ARETE (coming soon)
    </a>
  </section>
);

export default Arete;
