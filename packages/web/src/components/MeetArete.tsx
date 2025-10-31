import { FormEvent, useEffect, useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import ProvenanceFooter from './ProvenanceFooter';
import type { ResponseMetadata } from 'ethics-core';

// Module augmentation for Vite environment variables
declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly VITE_TURNSTILE_SITE_KEY: string;
    readonly VITE_SKIP_CAPTCHA: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Provide a stable fallback response in case the backend is unavailable so the space stays welcoming.
const FALLBACK_REFLECTION =
  'I was unable to generate a response - please try again later.';

// Map provenance strings to union values
const normalizeProvenance = (provenance: string): 'Retrieved' | 'Inferred' | 'Speculative' => {
  const normalized = provenance.toLowerCase();
  if (normalized === 'retrieved') return 'Retrieved';
  if (normalized === 'inferred') return 'Inferred';
  if (normalized === 'speculative') return 'Speculative';
  return 'Inferred'; // Default to 'Inferred' when unknown
};

// Normalize backend metadata to ResponseMetadata format
const normalizeMetadata = (backendMetadata: any): ResponseMetadata => {
  // Type guard: check if backendMetadata already matches ResponseMetadata structure
  if (backendMetadata && 
      typeof backendMetadata.responseId === 'string' &&
      typeof backendMetadata.riskTier === 'string' &&
      (backendMetadata.riskTier === 'Low' || backendMetadata.riskTier === 'Medium' || backendMetadata.riskTier === 'High') &&
      typeof backendMetadata.provenance === 'string' &&
      (backendMetadata.provenance === 'Retrieved' || backendMetadata.provenance === 'Inferred' || backendMetadata.provenance === 'Speculative') &&
      Array.isArray(backendMetadata.citations)) {
    // Convert string URLs to URL objects if needed
    const processedCitations = backendMetadata.citations.map((citation: any) => {
      if (typeof citation.url === 'string') {
        try {
          return {
            ...citation,
            url: new URL(citation.url)
          };
        } catch (error) {
          console.warn('Invalid citation URL:', citation.url, error);
          return null;
        }
      }
      return citation;
    }).filter(Boolean);
    
    return {
      ...backendMetadata,
      citations: processedCitations
    } as ResponseMetadata;
  }

  // Map backend fields to ResponseMetadata structure
  const normalized: ResponseMetadata = {
    responseId: backendMetadata.responseId || backendMetadata.id || 'unknown',
    provenance: backendMetadata.provenance ? normalizeProvenance(backendMetadata.provenance) : 'Inferred',
    confidence: typeof backendMetadata.confidence === 'number' ? backendMetadata.confidence : 0.5,
    riskTier: (backendMetadata.riskTier === 'Low' || backendMetadata.riskTier === 'Medium' || backendMetadata.riskTier === 'High') 
              ? backendMetadata.riskTier 
              : backendMetadata.reasoningEffort === 'low' ? 'Low' : 
                backendMetadata.reasoningEffort === 'medium' ? 'Medium' : 
                backendMetadata.reasoningEffort === 'high' ? 'High' : 'Low',
    tradeoffCount: backendMetadata.tradeoffCount || 0,
    chainHash: backendMetadata.chainHash || 'unknown',
    licenseContext: backendMetadata.licenseContext || 'MIT + HL3',
    modelVersion: backendMetadata.runtimeContext?.modelVersion || backendMetadata.model || 'unknown',
    staleAfter: backendMetadata.staleAfter || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    citations: []
  };

  // Process citations if they exist
  if (backendMetadata.citations && Array.isArray(backendMetadata.citations)) {
    normalized.citations = backendMetadata.citations.map((citation: any) => {
      try {
        return {
          title: citation.title || 'Untitled',
          url: new URL(citation.url),
          snippet: citation.snippet
        };
      } catch (error) {
        console.warn('Invalid citation URL:', citation.url, error);
        return null;
      }
    }).filter(Boolean);
  }

  return normalized;
};

const MeetArete = (): JSX.Element => {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('');
  const [answer, setAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [metadata, setMetadata] = useState<ResponseMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Skip CAPTCHA in development mode
  const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_SKIP_CAPTCHA === 'true';

  // Turnstile callback functions
  const onTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
    setIsTurnstileReady(true);
    setTurnstileError(null);
    // Auto-focus the input field when CAPTCHA is completed
    inputRef.current?.focus();
  };

  const onTurnstileError = () => {
    setTurnstileError('CAPTCHA verification failed. Please try again.');
    setIsTurnstileReady(false);
    setTurnstileToken(null);
  };

  const onTurnstileExpire = () => {
    setTurnstileToken(null);
    setIsTurnstileReady(false);
    setTurnstileError('CAPTCHA expired. Please verify again.');
  };

  // Animate the text reveal whenever the answer changes for a gentle typewriter feel.
  useEffect(() => {
    if (!answer) {
      setDisplayedAnswer('');
      setIsTypingComplete(false);
      return;
    }

    if (import.meta.env.DEV) {
      console.log('Starting animation with answer:', answer);
      console.log('Answer type:', typeof answer);
      console.log('Answer length:', answer.length);
    }
    
    setDisplayedAnswer('');
    setIsTypingComplete(false);
    const characters = Array.from(answer);
    
    let index = 0;

    const interval = window.setInterval(() => {
      const char = characters[index];
      setDisplayedAnswer((previous) => previous + char);
      index += 1;

      if (index >= characters.length) {
        window.clearInterval(interval);
        setIsTypingComplete(true);
        if (import.meta.env.DEV) {
          console.log('Animation complete');
        }
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

    if (!isDevelopment && !turnstileToken) {
      setStatus('Please complete the CAPTCHA verification.');
      return;
    }

    // Abort any in-flight request when a new one starts to avoid race conditions.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setStatus('Listening...');
    setAnswer('');
    setMetadata(null);
    setIsTypingComplete(false);

    try {
      const headers: Record<string, string> = { 
        Accept: 'application/json'
      };
      
      // Only add CAPTCHA token if we have one (not in development mode)
      if (!isDevelopment && turnstileToken) {
        headers['x-turnstile-token'] = turnstileToken;
      }
      
      if (import.meta.env.DEV) {
        console.log('=== CAPTCHA Debug Info ===');
        console.log('Making request to:', `/api/reflect?question=${encodeURIComponent(trimmedQuestion)}`);
        console.log('Development mode:', isDevelopment);
        console.log('Turnstile token exists:', !!turnstileToken);
        console.log('Turnstile token length:', turnstileToken?.length || 0);
        console.log('Turnstile ready:', isTurnstileReady);
        console.log('Turnstile error:', turnstileError);
        console.log('Headers:', headers);
        console.log('========================');
      }
      
      const response = await fetch(`/api/reflect?question=${encodeURIComponent(trimmedQuestion)}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      if (import.meta.env.DEV) {
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (!response.ok) {
        // Handle CAPTCHA-specific errors
        if (response.status === 403) {
          try {
            const errorData = await response.json();
            if (import.meta.env.DEV) {
              console.error('CAPTCHA verification failed (403):');
              console.error('Error data:', errorData);
              console.error('Error details:', errorData.details);
            }
            
            const errorMessage = errorData.details 
              ? `CAPTCHA verification failed: ${errorData.details}. Please refresh and try again.`
              : 'CAPTCHA verification failed. Please refresh and try again.';
            
            setStatus(errorMessage);
            setTurnstileToken(null);
            setIsTurnstileReady(false);
            setTurnstileError(errorMessage);
            setTurnstileKey(prev => prev + 1);
            return;
          } catch (parseError) {
            if (import.meta.env.DEV) {
              console.error('Failed to parse 403 error response:', parseError);
            }
            setStatus('CAPTCHA verification failed. Please refresh and try again.');
            setTurnstileToken(null);
            setIsTurnstileReady(false);
            setTurnstileError('CAPTCHA verification failed. Please refresh and try again.');
            setTurnstileKey(prev => prev + 1);
            return;
          }
        }
        
        // Handle 502 Turnstile service errors
        if (response.status === 502) {
          try {
            const errorData = await response.json();
            if (import.meta.env.DEV) {
              console.error('CAPTCHA service error (502):');
              console.error('Error data:', errorData);
            }
            if (errorData.error && errorData.error.includes('CAPTCHA verification service unavailable')) {
              setStatus('CAPTCHA service is unavailable. Please try again shortly.');
              setTurnstileToken(null);
              setIsTurnstileReady(false);
              setTurnstileError('CAPTCHA service is unavailable. Please try again shortly.');
              setTurnstileKey(prev => prev + 1);
              return;
            }
          } catch {
            // If JSON parsing fails, still show the 502 error
            if (import.meta.env.DEV) {
              console.error('Failed to parse 502 error response');
            }
            setStatus('CAPTCHA service is unavailable. Please try again shortly.');
            setTurnstileToken(null);
            setIsTurnstileReady(false);
            setTurnstileError('CAPTCHA service is unavailable. Please try again shortly.');
            setTurnstileKey(prev => prev + 1);
            return;
          }
        }
        
        throw new Error(`Unexpected response status: ${response.status}`);
      }

      const payload = await response.json();
      if (import.meta.env.DEV) {
        console.log('Response payload:', payload);
      }
      
      const reflection = payload.message as string | undefined;
      const backendMetadata = payload.metadata;
      
      if (import.meta.env.DEV) {
        console.log('Extracted reflection:', reflection);
        console.log('Extracted metadata:', backendMetadata);
        console.log('Reflection type:', typeof reflection);
        console.log('Reflection length:', reflection?.length);
      }
      
      setStatus('A brief reflection:');
      setAnswer(
        reflection?.trim() ||
          'I would begin by examining the ethical principles involved, then consider what transparency and care require.',
      );
      
      // Normalize backend metadata to ResponseMetadata format
      const normalizedMetadata = backendMetadata ? normalizeMetadata(backendMetadata) : null;
      setMetadata(normalizedMetadata);
      
      // Reset Turnstile for next question by forcing re-render
      setTurnstileToken(null);
      setIsTurnstileReady(false);
      setTurnstileKey(prev => prev + 1);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.log('Error caught:', error);
      }
      
      if ((error as Error).name === 'AbortError') {
        if (import.meta.env.DEV) {
          console.log('Request was aborted');
        }
        return;
      }

      // Check for CAPTCHA-related errors
      if (error instanceof Error && (error.message.includes('CAPTCHA') || error.message.includes('403'))) {
        if (import.meta.env.DEV) {
          console.log('CAPTCHA-related error:', error.message);
        }
        setStatus('CAPTCHA verification failed. Please refresh and try again.');
        setTurnstileToken(null);
        setIsTurnstileReady(false);
        setTurnstileError('CAPTCHA verification failed. Please refresh and try again.');
        return;
      }

      if (import.meta.env.DEV) {
        console.log('Using fallback response due to error:', error);
      }
      setStatus('My thoughts:');
      setAnswer(FALLBACK_REFLECTION);
      setMetadata(null);
      setIsTypingComplete(false);
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
          <strong className="interaction-heading">Ask me anything</strong>
          <p className="interaction-description">
            I help you think through tough questions while staying honest and fair. I explore multiple ethical perspectives, 
            trace my sources, and show you how I reach my conclusions.
          </p>
            <form className="interaction-form" onSubmit={onSubmit}>
              <div className="interaction-input-group">
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
                <button type="submit" className="interaction-submit" disabled={isLoading || (!isDevelopment && !isTurnstileReady)}>
                  {!isDevelopment && !isTurnstileReady && !isLoading ? 'Complete CAPTCHA' : isLoading ? 'Listening…' : 'Share'}
                </button>
              </div>
              {!isDevelopment && (
                <div className="interaction-captcha" aria-label="Complete CAPTCHA verification to submit your question">
                  <Turnstile
                    key={turnstileKey}
                    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                    onSuccess={onTurnstileVerify}
                    onError={onTurnstileError}
                    onExpire={onTurnstileExpire}
                    options={{
                      theme: 'light',
                      size: 'normal',
                      language: 'auto'
                    }}
                  />
                  {turnstileError && <p className="interaction-error" role="alert">{turnstileError}</p>}
                </div>
              )}
            </form>
            <div className="interaction-status" role="status">
              {isLoading && <span className="spinner" aria-hidden="true" />}
              <span>{status || (!isDevelopment && !isTurnstileReady && !turnstileError ? 'Verifying you\'re human…' : '')}</span>
            </div>
            {(displayedAnswer || isLoading) && (
              <div className="interaction-output" aria-live="polite">
                {displayedAnswer}
              </div>
            )}
            {isTypingComplete && metadata && (
              <ProvenanceFooter metadata={metadata} />
            )}
        </div>
      </div>
    </section>
  );
};

export default MeetArete;
