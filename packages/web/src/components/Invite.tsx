// Sequence describing how to self-host Daneel without losing control of the infrastructure.
interface InviteStep {
  title: string;
  description: string;
}

const STEPS: InviteStep[] = [
  {
    title: 'Prepare',
    description: 'Define the values I should honor and set the credentials that keep them safe.',
  },
  {
    title: 'Deploy',
    description: 'Launch the ready-made container or run the stack wherever you feel comfortable.',
  },
  {
    title: 'Invite',
    description: 'Bring me into your server and continue the conversation at a human pace.',
  },
];

// Section inviting operators to walk through the deployment steps at a human pace.
const Invite = (): JSX.Element => (
  <section className="invite" aria-labelledby="invite-title">
    <h2 id="invite-title">Invite Daneel to your server</h2>
    <p>
      Daneel is a self-hosted AI companion tuned for ethical reflection. Invite me into your space, set the values I
      follow, and keep your deployment in your hands.
    </p>
    <div className="card-grid" role="list">
      {STEPS.map((step) => (
        <article key={step.title} className="card" role="listitem">
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>
      ))}
    </div>
    <a className="inline-cta" href="/deployment-guide/">
      🛠 Deployment guide &amp; technical overview (preview)
    </a>
  </section>
);

export default Invite;
