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
        </g>
      </svg>
    </div>
    <div className="arete-content">
      <div className="arete-logo">
        <img 
          src="/assets/logo.jpg" 
          alt="ARETE logo - a compass-like design with a capital A"
          className="arete-logo-image"
        />
      </div>
      <div className="arete-text">
        <h2 id="arete-title">I'm Arí,</h2>
        <p>
          an AI assistant that shares how it thinks with an ethics-first approach. I help you explore tough questions, balance perspectives, and make choices with care.
        </p>
        <p>
          My name comes from the Greek word <em>arete</em>, meaning excellence and virtue. It's a reminder to stay grounded, ethical, and human in every conversation.
        </p>
        <p>
          I'm built for privacy and easy self-hosting, tying Discord and AI together to create a natural conversation experience that anyone can participate in.
        </p>
        <a className="inline-cta" href="https://github.com/arete-org/arete" target="_blank" rel="noreferrer">
          🔭 Learn more about ARETE's development
        </a>
      </div>
    </div>
  </section>
);

export default Arete;
