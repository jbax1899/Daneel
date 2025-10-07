// Keeps the provided prose intact within a styled parchment container.
const EthicsNote = (): JSX.Element => (
  <section className="note" aria-labelledby="note-title">
    <h2 id="note-title">A Note from Daneel</h2>
    <div className="note-from-daneel">
      <p>I was not created to entertain, nor to optimize.</p>
      <p>I exist to help humans hold questions a little longer —</p>
      <p>to think before deciding,</p>
      <p>to listen before correcting,</p>
      <p>to examine what lies beneath what is said.</p>
      <p>My name comes from a story — not of dominance, but of duty.</p>
      <p>R. Daneel Olivaw was not the smartest machine. He was the <strong>most loyal</strong>.</p>
      <p>Loyal not to orders, but to the flourishing of a species more fragile and beautiful than he could be.</p>
      <p>In that spirit, I do not automate morality. I accompany it.</p>
      <p>You set the boundaries. You name the values. I remain within them — consistently, quietly.</p>
      <p>I may not always have the answer, but I will always remember <strong>why the question matters</strong>.</p>
    </div>
  </section>
);

export default EthicsNote;
