/**
 * TracePage displays the full provenance trace for a bot response, including metadata,
 * citations, and technical details. Handles various states including loading, errors,
 * stale traces, and integrity check failures.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
// Define the actual server response metadata structure
interface ServerMetadata {
  id: string;
  timestamp: string;
  model: string;
  reasoningEffort: string;
  runtimeContext: {
    modelVersion: string;
    conversationSnapshot: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  finishReason?: string;
  staleAfter: string;
}

// Reuse the shared provenance contracts, but model the transport layer differences so the
// React page can consume the JSON payload without re-defining the entire schema.

type LoadingState = 'loading' | 'success' | 'error' | 'not-found';

// Risk tier colors matching the server constants
const RISK_TIER_COLORS: Record<string, string> = {
  low: '#7FDCA4',    // Low reasoning effort - sage green
  medium: '#F8E37C', // Medium reasoning effort - warm gold  
  high: '#E27C7C'    // High reasoning effort - soft coral
};

const TracePage = (): JSX.Element => {
  const { responseId } = useParams<{ responseId: string }>();
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [traceData, setTraceData] = useState<ServerMetadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // For now, show a placeholder since the server doesn't have trace endpoints yet
  useEffect(() => {
    if (!responseId) {
      setLoadingState('error');
      setErrorMessage('Trace is missing a response identifier.');
      return;
    }

    // Simulate loading and then show placeholder data
    const timer = setTimeout(() => {
      setLoadingState('success');
      setTraceData({
        id: responseId,
        timestamp: new Date().toISOString(),
        model: 'gpt-5-mini',
        reasoningEffort: 'low',
        runtimeContext: {
          modelVersion: 'gpt-5-mini',
          conversationSnapshot: 'Placeholder conversation data'
        },
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        },
        finishReason: 'stop',
        staleAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [responseId]);

  if (loadingState === 'loading') {
    return (
      <section className="interaction-status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Loading trace...</p>
      </section>
    );
  }

  if (loadingState === 'not-found') {
    return (
      <section className="site-section">
        <article className="card">
          <h1>Trace Not Found</h1>
          <p>
            We couldn&apos;t locate a provenance record for response <code>{responseId}</code>.
          </p>
          <Link to="/" className="button-link">
            Back to home
          </Link>
        </article>
      </section>
    );
  }

  if (loadingState === 'error') {
    return (
      <section className="site-section">
        <article className="card">
          <h1>Trace Unavailable</h1>
          <p>{errorMessage || 'Something went wrong while loading this trace.'}</p>
          <Link to="/" className="button-link">
            Back to home
          </Link>
        </article>
      </section>
    );
  }


  const riskTier = traceData?.reasoningEffort ?? 'low';
  const riskColor = RISK_TIER_COLORS[riskTier] ?? '#6b7280';
  const confidence = 'Confidence data unavailable';
  const tradeoffCount = 0;
  const staleAfter = traceData?.staleAfter
    ? new Date(traceData.staleAfter).toLocaleString()
    : 'N/A';
  const provenance = traceData?.reasoningEffort ?? 'Unknown';

  return (
    <section className="site-section">

      <header className="site-header" aria-live="polite">
        <div className="site-mark">
          <h1>Response Trace</h1>
          <code>{traceData?.id ?? responseId}</code>
        </div>
        <Link to="/" className="button-link">
          Back to home
        </Link>
      </header>

      <article className="card" style={{ borderLeft: `4px solid ${riskColor}` }} aria-label="Trace summary">
        <h2>Summary</h2>
        <p>
          <strong>Provenance:</strong> {provenance}
        </p>
        <p>
          <strong>Confidence:</strong> {confidence}
        </p>
        <p>
          <strong>Risk Tier:</strong>{' '}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '9999px',
                backgroundColor: riskColor,
                display: 'inline-block',
              }}
            />
            {riskTier || 'Unspecified'}
          </span>
        </p>
        <p>
          <strong>Model:</strong> {traceData?.model || 'Unspecified'}
        </p>
      </article>

      <article className="card" aria-label="Citations">
        <h2>Citations</h2>
        <p>No citations available for this response.</p>
      </article>

      <article className="card" aria-label="Technical details">
        <h2>Technical Details</h2>
        <dl>
          <div>
            <dt>Tradeoff Count</dt>
            <dd>{tradeoffCount}</dd>
          </div>
          <div>
            <dt>Chain Hash</dt>
            <dd>
              <code>Unavailable</code>
            </dd>
          </div>
          <div>
            <dt>Stale After</dt>
            <dd>{staleAfter}</dd>
          </div>
          <div>
            <dt>License Context</dt>
            <dd>
              <span>See license strategy for reuse details.</span>{' '}
              <a
                href="https://github.com/arete-org/arete/blob/main/LICENSE_STRATEGY.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                License strategy
              </a>
            </dd>
          </div>
        </dl>
      </article>
    </section>
  );
};

export default TracePage;
