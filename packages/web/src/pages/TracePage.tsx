/**
 * TracePage displays the full provenance trace for a bot response, including metadata,
 * citations, and technical details. Handles various states including loading, errors,
 * stale traces, and integrity check failures.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Citation, ResponseMetadata } from '@ethics-core';

// Reuse the shared provenance contracts, but model the transport layer differences so the
// React page can consume the JSON payload without re-defining the entire schema.

type CitationExtras = {
  sourceType?: string;
  summary?: string;
};

type SerializableCitation = (Omit<Citation, 'url'> & { url: string }) & CitationExtras;

type SerializableResponseMetadata = Omit<ResponseMetadata, 'citations'> & {
  citations: SerializableCitation[];
  tradeoffs?: unknown[];
};

type LoadingState = 'loading' | 'success' | 'error' | 'stale' | 'hash-mismatch' | 'not-found';

// Keep the color encoding in a single map so both styling and legends stay consistent.
const RISK_TIER_COLORS: Record<string, string> = {
  low: '#00FF00',
  medium: '#FFFF00',
  high: '#FF0000',
};

const formatDomain = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

const formatConfidence = (confidence?: number): string => {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'N/A';
  }
  const percentage = Math.round(confidence * 100);
  return `${Math.min(100, Math.max(0, percentage))}%`;
};

// Some endpoints bundle the metadata under a top-level `metadata` key, so we unwrap in a
// defensive helper to preserve compatibility with earlier worker builds.
const extractPayload = (data: unknown): SerializableResponseMetadata | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('metadata' in data && data.metadata && typeof data.metadata === 'object') {
    return data.metadata as SerializableResponseMetadata;
  }

  return data as SerializableResponseMetadata;
};

const getSourceType = (citation: SerializableCitation): string | undefined => {
  const rawSourceType = citation.sourceType;
  return typeof rawSourceType === 'string' && rawSourceType.length > 0 ? rawSourceType : undefined;
};

const getSummary = (citation: SerializableCitation): string | undefined => {
  if (typeof citation.summary === 'string' && citation.summary.length > 0) {
    return citation.summary;
  }
  if (typeof citation.snippet === 'string' && citation.snippet.length > 0) {
    return citation.snippet;
  }
  return undefined;
};

const TracePage = (): JSX.Element => {
  const { responseId } = useParams<{ responseId: string }>();
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [traceData, setTraceData] = useState<SerializableResponseMetadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch the persisted trace whenever the response identifier changes. The handler accounts
  // for all server status codes so we can present purpose-built UI states to the user.
  useEffect(() => {
    if (!responseId) {
      setLoadingState('error');
      setErrorMessage('Trace is missing a response identifier.');
      return;
    }

    let isMounted = true;

    const loadTrace = async () => {
      setLoadingState('loading');
      setErrorMessage('');
      setTraceData(null);

      try {
        const response = await fetch(`/trace/${responseId}.json`);

        if (response.status === 200) {
          const payload = (await response.json()) as SerializableResponseMetadata;
          if (!isMounted) {
            return;
          }
          setTraceData(payload);
          setLoadingState('success');
          return;
        }

        if (response.status === 404) {
          if (!isMounted) {
            return;
          }
          setLoadingState('not-found');
          return;
        }

        if (response.status === 410) {
          const payload = extractPayload(await response.json().catch(() => null));
          if (!isMounted) {
            return;
          }
          if (payload) {
            setTraceData(payload);
          }
          setLoadingState('stale');
          return;
        }

        if (response.status === 409) {
          if (!isMounted) {
            return;
          }
          setLoadingState('hash-mismatch');
          return;
        }

        const message = await response.text();
        if (!isMounted) {
          return;
        }
        setErrorMessage(message || 'Failed to load trace.');
        setLoadingState('error');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load trace.');
        setLoadingState('error');
      }
    };

    void loadTrace();

    return () => {
      isMounted = false;
    };
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

  if (loadingState === 'hash-mismatch') {
    return (
      <section className="site-section">
        <div className="note-from-daneel" role="alert" style={{ borderTopColor: '#FF0000' }}>
          <h1>Integrity Check Failed</h1>
          <p>
            The provided trace hash does not match the stored value. Please confirm the link and try
            again from a trusted source.
          </p>
          <Link to="/" className="button-link">
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  const riskTier = traceData?.riskTier ?? '';
  const riskColor = RISK_TIER_COLORS[riskTier.toLowerCase()] ?? '#6b7280';
  const confidence = formatConfidence(traceData?.confidence);
  const tradeoffCount =
    // Older traces persisted the raw tradeoff array; newer ones expose a count. Support both.
    typeof traceData?.tradeoffCount === 'number'
      ? traceData.tradeoffCount
      : Array.isArray(traceData?.tradeoffs)
        ? traceData?.tradeoffs.length ?? 0
        : 0;
  const staleAfter = traceData?.staleAfter
    ? new Date(traceData.staleAfter).toLocaleString()
    : 'N/A';
  const provenance = traceData?.provenance ?? 'Unknown';

  return (
    <section className="site-section">
      {loadingState === 'stale' && (
        <div className="note-from-daneel" role="note" style={{ borderTopColor: '#FFA500' }}>
          <h2>Trace Expired</h2>
          <p>
            This trace is past its freshness window. Review the details below for historical
            reference, but request a fresh response if you need the most current analysis.
          </p>
        </div>
      )}

      <header className="site-header" aria-live="polite">
        <div className="site-mark">
          <h1>Response Trace</h1>
          <code>{traceData?.responseId ?? responseId}</code>
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
          <strong>Model:</strong> {traceData?.modelVersion || 'Unspecified'}
        </p>
      </article>

      {traceData?.citations && traceData.citations.length > 0 && (
        <article className="card" aria-label="Citations">
          <h2>Citations</h2>
          <ul>
            {traceData.citations.map((citation, index) => {
              const domain = formatDomain(citation.url);
              const sourceType = getSourceType(citation);
              const summary = getSummary(citation);

              // Citations may point to internal docs or public sources; surface whatever
              // metadata we have so analysts can verify provenance quickly.
              return (
                <li key={`${citation.url}-${citation.title}-${index}`}>
                  <a href={citation.url} target="_blank" rel="noopener noreferrer">
                    {citation.title}
                  </a>
                  <p className="meta">
                    {domain}
                    {sourceType ? ` - ${sourceType}` : ''}
                  </p>
                  {summary && <p>{summary}</p>}
                </li>
              );
            })}
          </ul>
        </article>
      )}

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
              <code>{traceData?.chainHash || 'Unavailable'}</code>
            </dd>
          </div>
          <div>
            <dt>Stale After</dt>
            <dd>{staleAfter}</dd>
          </div>
          <div>
            <dt>License Context</dt>
            <dd>
              {traceData?.licenseContext ? (
                <span>{traceData.licenseContext}</span>
              ) : (
                <span>See license strategy for reuse details.</span>
              )}{' '}
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
