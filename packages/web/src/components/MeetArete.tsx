import { FormEvent, useEffect, useRef, useState } from 'react';

// Provide a stable fallback response in case the backend is unavailable so the space stays welcoming.
const FALLBACK_REFLECTION =
  'Ethical reasoning requires patience, transparency, and care for others.';

const MeetArete = (): JSX.Element => {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('');
  const [answer, setAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Animate the text reveal whenever the answer changes for a gentle typewriter feel.
  useEffect(() => {
    if (!answer) {
      setDisplayedAnswer('');
      return;
    }

    setDisplayedAnswer('');
    const characters = Array.from(answer);
    let index = 0;

    const interval = window.setInterval(() => {
      setDisplayedAnswer((previous) => previous + characters[index]);
      index += 1;

      if (index >= characters.length) {
        window.clearInterval(interval);
      }
    }, 22);

    return () => window.clearInterval(interval);
  }, [answer]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setStatus('Please share a question, even a small one.');
      return;
    }

    // Abort any in-flight request when a new one starts to avoid race conditions.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setStatus('Listening...');
    setAnswer('');

    try {
      const response = await fetch(`/api/reflect?question=${encodeURIComponent(trimmedQuestion)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Unexpected response');
      }

      const payload = await response.json();
      const reflection = (payload.reply || payload.message || payload.output) as string | undefined;
      setStatus('A brief reflection:');
      setAnswer(
        reflection?.trim() ||
          'I would begin by examining the ethical principles involved, then consider what transparency and care require.',
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      setStatus('A brief reflection (cached):');
      setAnswer(FALLBACK_REFLECTION);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <section className="meet" aria-labelledby="meet-title">
      <div className="meet-copy">
        <div className="interaction">
          <strong className="interaction-heading">Try asking me something</strong>
          <p className="interaction-description">
            I help you think through tough questions while staying honest and fair. I explore multiple ethical perspectives, 
            trace my sources, and show you how I reach my conclusions.
          </p>
            <form className="interaction-form" onSubmit={onSubmit}>
              <input
                id="question-input"
                className="interaction-input"
                name="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What should we talk about?"
                autoComplete="off"
                ref={inputRef}
              />
              <button type="submit" className="interaction-submit" disabled={isLoading}>
                {isLoading ? 'Listening…' : 'Share'}
              </button>
            </form>
            <div className="interaction-status" role="status">
              {isLoading && <span className="spinner" aria-hidden="true" />}
              <span>{status}</span>
            </div>
            {(displayedAnswer || isLoading) && (
              <div className="interaction-output" aria-live="polite">
                {displayedAnswer}
              </div>
            )}
        </div>
      </div>
    </section>
  );
};

export default MeetArete;
