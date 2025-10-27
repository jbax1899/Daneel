// Section explaining ARETE's philosophy and commitment to ethical AI.
const Arete = (): JSX.Element => (
  <section className="arete" aria-labelledby="arete-title">
    <div className="arete-background" aria-hidden="true">
      {/* Symbolic constellation representing ARETE's ethical framework. */}
      <svg viewBox="0 0 320 120" role="presentation" focusable="false">
        <g className="arete-constellation">
          <circle cx="30" cy="60" r="4" />
          <circle cx="110" cy="30" r="3" />
          <circle cx="200" cy="65" r="4" />
          <circle cx="280" cy="40" r="3" />
          <path d="M30 60 L110 30 L200 65 L280 40" />
          <text x="22" y="90">Ethics</text>
          <text x="180" y="110">ARETE</text>
        </g>
      </svg>
    </div>
    <h2 id="arete-title">ARETE: Ethics-First AI Assistant</h2>
    <p>
      ARETE represents the pursuit of excellence in AI-assisted reasoning. I am designed to be transparent, ethical,
      and helpful — explaining my reasoning while respecting your privacy and values.
    </p>
    <p>
      I was named for the ancient Greek concept of excellence and virtue. Like the pursuit of arete itself, I aim to be
      steady, helpful, and ethical within the boundaries you choose.
    </p>
    <p>
      My capabilities include ethical reasoning, transparent explanations, real-time search, voice interaction, and
      image understanding — all built with privacy and self-hosting in mind.
    </p>
    <a className="inline-cta" href="https://github.com/arete-ai/arete" target="_blank" rel="noreferrer">
      🔭 Learn more about ARETE's development
    </a>
  </section>
);

export default Arete;
