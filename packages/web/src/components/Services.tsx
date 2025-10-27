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
    description: 'Ethical reasoning with transparent explanations, helping you think through complex decisions.',
    quote: '"Let me explain my reasoning and help you consider the ethical implications."',
  },
  {
    id: 'realtime',
    title: 'Realtime search',
    description: 'Fetch cited updates from the web and respond with context-aware summaries.',
    quote: '"Here is what changed — and what ethical considerations this raises."',
  },
  {
    id: 'call',
    title: '/call',
    description: 'Join a voice channel and speak to ARETE in realtime — with summaries, memory, and ethical guidance.',
    quote: '"I hear you - Let me help you think through this."',
  },
  {
    id: 'understanding',
    title: 'Image understanding',
    description: 'When images are shared, I analyze them for meaning and context. No command needed.',
    quote: '"I see this image raises questions about representation. Shall we discuss it?"',
  },
  {
    id: 'image',
    title: '/image',
    description: 'Transform prompts into reflective or illustrative artwork, complete with ethical captions.',
    quote: '"I\'ve created an image that reflects the values we discussed — transparency and care."',
    variant: 'wide',
  },
];

// Feature spread showing present-day capabilities with gentle supporting quotes.
const Services = (): JSX.Element => (
  <section className="services" aria-labelledby="services-title">
    <h2 id="services-title">How I serve you</h2>
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
