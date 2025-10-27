// Pillars emphasising openness so future contributors understand the governance philosophy.
interface Principle {
  title: string;
  description: string;
}

const PRINCIPLES: Principle[] = [
  {
    title: 'Open source',
    description:
      'Everything\'s in the open. Explore the code, learn from it, or make it your own.',
  },
  {
    title: 'Self-hosted first',
    description:
      'You own the keys and decide where Ari lives. Your server, your rules.',
  },
  {
    title: 'Dual license',
    description:
      'MIT + Hippocratic — open for everyone, grounded in ethics.',
  },
];

// Transparency block with three concise commitments.
const OpenAccountable = (): JSX.Element => (
  <section className="transparency" aria-labelledby="transparency-title">
    <h2 id="transparency-title">Open and accountable</h2>
    <div className="card-grid" role="list">
      {PRINCIPLES.map((principle) => (
        <article key={principle.title} className="card" role="listitem">
          <h3>{principle.title}</h3>
          <p>{principle.description}</p>
        </article>
      ))}
    </div>
  </section>
);

export default OpenAccountable;
