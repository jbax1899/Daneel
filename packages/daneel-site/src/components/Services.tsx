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
    description: 'Gentle replies that surface shared values, pause the pace, and guide reflection.',
    quote: '“Let us examine the feeling beneath that concern.”',
  },
  {
    id: 'realtime',
    title: 'Realtime search',
    description: 'Fetch cited updates from the web and respond with context-aware summaries.',
    quote: '“Here is what changed — and what care might ask of us.”',
  },
  {
    id: 'call',
    title: '/call',
    description: 'Join a voice channel and speak to Daneel in realtime — with summaries, memory, and tone.',
    quote: '“You spoke of patience, and how it steadies the room.”',
  },
  {
    id: 'understanding',
    title: 'Image understanding',
    description: 'When images are shared, I look within them for meaning. No command needed.',
    quote: '“I see a quiet scene. Would you like to talk about it?”',
  },
  {
    id: 'image',
    title: '/image',
    description: 'Transform prompts into reflective or illustrative artwork, complete with captions.',
    quote: '“A lantern in a study, waiting for the next reader.”',
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
