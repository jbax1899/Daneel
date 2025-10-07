// Pillars emphasising openness so future contributors understand the governance philosophy.
interface Principle {
  title: string;
  description: string;
}

const PRINCIPLES: Principle[] = [
  {
    title: 'Open source',
    description:
      'Every decision lives in the open repository. Fork it, study it, and change it to match your community.',
  },
  {
    title: 'Self-hosted first',
    description:
      'Keep your keys and choose the deployment path. Steward the conversations that flow through your spaces.',
  },
  {
    title: 'Permissive license',
    description:
      'The MIT license keeps Daneel adaptable. Carry forward what helps, share discoveries back when you can.',
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
