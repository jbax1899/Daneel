// Each feature card highlights a distinct ability while keeping copy warm and concrete.
interface ServiceFeature {
  id: string;
  title: string;
  description: string;
  quote: string;
  variant?: 'wide';
}

const FEATURES: ServiceFeature[] = [
  {
    id: 'chat',
    title: 'Chat',
    description: 'Ask me to unpack my reasoning, explore ideas, or help guide conversations — always with transparency.',
    quote: '“Here\'s how I\'m thinking about that. See if my reasoning makes sense to you.”',
  },
  {
    id: 'realtime',
    title: 'Realtime search',
    description: 'Fetch cited updates from the web and respond with context-aware summaries.',
    quote: '“I found a few reliable updates on that. Let\'s look at what\'s changed — and why it matters.”',
  },
  {
    id: 'call',
    title: '/call',
    description: 'Join a voice channel and speak to ARETE in realtime.',
    quote: '“I\'m listening — Take your time.”',
  },
  {
    id: 'understanding',
    title: 'Image understanding',
    description: 'When images are shared, I analyze them for meaning and context. No command needed.',
    quote: '“I notice some interesting themes in this image.”',
  },
  {
    id: 'image',
    title: '/image',
    description: 'Turn prompts into reflective or illustrative artwork, complete with thoughtful captions.',
    quote: '“Here\'s what I imagined — an image shaped by the ideas we talked about.”',
    variant: 'wide',
  },
];

// Feature spread showing present-day capabilities with gentle supporting quotes.
const Services = (): JSX.Element => (
  <section className="services" aria-labelledby="services-title">
    <h2 id="services-title">What I can do for you</h2>
    <div className="services-grid">
      {FEATURES.map((feature) => (
        <article
          key={feature.id}
          className={`feature-card${feature.variant === 'wide' ? ' feature-card--wide' : ''}`}
          aria-labelledby={`${feature.id}-title`}
        >
          <div className="feature-card__body">
            <h3 id={`${feature.id}-title`}>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
          <p className="feature-quote">{feature.quote}</p>
        </article>
      ))}
    </div>
  </section>
);

export default Services;
