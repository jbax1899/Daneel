/*
 * Simplified Node server for the web frontend API.
 * This is a minimal implementation that provides the /api/reflect endpoint
 * without the complex discord-bot dependencies.
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Load environment variables from .env file
require('dotenv').config();

// Resolve the directory containing the built frontend assets.
const DIST_DIR = path.join(__dirname, 'packages', 'web', 'dist');

// Model parameters
const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_REASONING_EFFORT = 'low';
const DEFAULT_VERBOSITY = 'low';
const DEFAULT_CHANNEL_CONTEXT = {
  channelId: 'default'
};

// Metadata parsing constants
const METADATA_MARKER = '<ARETE_METADATA>';

/**
 * Extracts text and metadata from AI response that may contain <ARETE_METADATA> payload
 */
function extractTextAndMetadata(rawOutputText) {
  if (!rawOutputText) {
    return { normalizedText: '', metadata: null };
  }

  const markerIndex = rawOutputText.lastIndexOf(METADATA_MARKER);
  if (markerIndex === -1) {
    // No metadata marker found, return plain text
    return { normalizedText: rawOutputText.trimEnd(), metadata: null };
  }

  const conversationalPortion = rawOutputText.slice(0, markerIndex).trimEnd();
  let metadataCandidate = rawOutputText.slice(markerIndex + METADATA_MARKER.length).trim();

  // Remove common code-fence wrappers
  metadataCandidate = metadataCandidate.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  metadataCandidate = metadataCandidate.replace(/^```\s*/, '').replace(/\s*```$/, '');

  if (!metadataCandidate) {
    return { normalizedText: conversationalPortion, metadata: null };
  }

  try {
    const parsed = JSON.parse(metadataCandidate);
    return { normalizedText: conversationalPortion, metadata: parsed };
  } catch (error) {
    console.warn('Failed to parse assistant metadata payload:', error);
    return { normalizedText: conversationalPortion, metadata: null };
  }
}

// Content-Type lookups keep browsers happy when serving static files.
const MIME_MAP = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

/**
 * Attempts to read a file from disk and returns undefined when the file is
 * missing. This keeps the control flow tidy when we try multiple fallbacks.
 */
const tryReadFile = async (filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      // Bubble up unexpected I/O errors so the caller can log the failure.
      throw error;
    }
    return undefined;
  }
};

/**
 * Small helper that sanitizes user-supplied paths so requests cannot escape the
 * dist directory. Any attempt to climb above the folder collapses to an empty
 * string, which we later interpret as the site root.
 */
const sanitizePath = (rawPath) => {
  const decoded = decodeURIComponent(rawPath.split('?')[0] || '/');
  const normalized = path.normalize(decoded);

  if (normalized.startsWith('..')) {
    return '';
  }

  return normalized.replace(/^\/+/, '');
};

/**
 * Resolves the file to serve for a given request.
 * - Direct file hits are served as-is.
 * - Directory requests append index.html.
 * - Missing files fall back to the SPA shell (index.html).
 */
const resolveAsset = async (requestPath) => {
  const sanitized = sanitizePath(requestPath);
  const targetPath = sanitized.length === 0 ? 'index.html' : sanitized;

  const absolutePath = path.join(DIST_DIR, targetPath);
  const stats = await fs
    .stat(absolutePath)
    .catch(() => undefined);

  if (stats && stats.isDirectory()) {
    const nestedIndex = path.join(absolutePath, 'index.html');
    const nestedContent = await tryReadFile(nestedIndex);
    if (nestedContent) {
      return { content: nestedContent, absolutePath: nestedIndex };
    }
  }

  const directContent = await tryReadFile(absolutePath);
  if (directContent) {
    return { content: directContent, absolutePath };
  }

  const fallbackPath = path.join(DIST_DIR, 'index.html');
  const fallbackContent = await tryReadFile(fallbackPath);
  if (fallbackContent) {
    return { content: fallbackContent, absolutePath: fallbackPath };
  }

  return undefined;
};

/**
 * Builds a short log entry for monitoring within Fly.io logs.
 */
const logRequest = (req, res, extra = '') => {
  const timestamp = new Date().toISOString();
  
  // Sanitize URL for /api/reflect to prevent CAPTCHA token leakage
  let logUrl = req.url;
  if (req.url && req.url.includes('/api/reflect')) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      // Reconstruct pathname without query parameters for reflect logs
      logUrl = parsedUrl.pathname;
    } catch (error) {
      // Fallback to original URL if parsing fails
      logUrl = req.url;
    }
  }
  
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] ${req.method} ${logUrl} -> ${res.statusCode} ${extra}`);
};

/**
 * Simple rate limiter implementation
 */
class SimpleRateLimiter {
  constructor(options) {
    this.limit = options.limit;
    this.window = options.window;
    this.requests = new Map();
  }

  check(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.window);
    
    if (validRequests.length >= this.limit) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + this.window - now) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return { allowed: true, retryAfter: 0 };
  }

  cleanup() {
    const now = Date.now();
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.window);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }
}

/**
 * Simple OpenAI service implementation
 */
class SimpleOpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async generateResponse(model, messages, options = {}) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || 'I was unable to generate a response.';
    
    // Parse metadata from the response if it contains <ARETE_METADATA>
    const { normalizedText, metadata: parsedMetadata } = extractTextAndMetadata(rawContent);
    
    return {
      normalizedText: normalizedText,
      metadata: {
        model: model, // Use the requested model, not what OpenAI returns
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason,
        // Include parsed metadata if available
        ...(parsedMetadata && {
          confidence: parsedMetadata.confidence,
          provenance: parsedMetadata.provenance,
          tradeoffCount: parsedMetadata.tradeoffCount,
          citations: parsedMetadata.citations
        })
      }
    };
  }
}

/**
 * Simple response metadata builder
 */
const buildResponseMetadata = (assistantMetadata, reasoningEffort, runtimeContext) => {
  return {
    id: `reflect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    model: assistantMetadata.model || DEFAULT_MODEL,
    reasoningEffort: assistantMetadata.reasoningEffort || DEFAULT_REASONING_EFFORT,
    verbosity: assistantMetadata.verbosity || DEFAULT_VERBOSITY,
    channelContext: assistantMetadata.channelContext || DEFAULT_CHANNEL_CONTEXT,
    runtimeContext,
    usage: assistantMetadata.usage,
    finishReason: assistantMetadata.finishReason,
    staleAfter: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
};

// Initialize services
let openaiService = null;
let ipRateLimiter = null;
let sessionRateLimiter = null;

const initializeServices = () => {
  // Debug: Log environment variables
  console.log('Environment variables check:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  console.log('TURNSTILE_SECRET_KEY:', process.env.TURNSTILE_SECRET_KEY ? 'SET' : 'NOT SET');
  console.log('TURNSTILE_SITE_KEY:', process.env.TURNSTILE_SITE_KEY ? 'SET' : 'NOT SET');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
  console.log('SKIP_CAPTCHA:', process.env.SKIP_CAPTCHA || 'NOT SET');
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  openaiService = new SimpleOpenAIService(process.env.OPENAI_API_KEY);
  
  // Initialize rate limiters
  ipRateLimiter = new SimpleRateLimiter({
    limit: parseInt(process.env.WEB_API_RATE_LIMIT_IP) || 3,
    window: parseInt(process.env.WEB_API_RATE_LIMIT_IP_WINDOW_MS) || 60000,
  });

  sessionRateLimiter = new SimpleRateLimiter({
    limit: parseInt(process.env.WEB_API_RATE_LIMIT_SESSION) || 5,
    window: parseInt(process.env.WEB_API_RATE_LIMIT_SESSION_WINDOW_MS) || 60000,
  });

  // Schedule periodic cleanup
  setInterval(() => {
    ipRateLimiter.cleanup();
    sessionRateLimiter.cleanup();
  }, 2 * 60 * 1000); // Cleanup every 2 minutes

  console.log('Services initialized successfully');
};

/**
 * Handles requests to the /api/reflect endpoint.
 */
const handleReflectRequest = async (req, res, parsedUrl) => {
  try {
    // Verify Turnstile configuration
    if (!process.env.TURNSTILE_SECRET_KEY) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'CAPTCHA verification not configured' }));
      logRequest(req, res, 'reflect captcha-not-configured');
      return;
    }

    // Allow GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      logRequest(req, res, 'reflect method-not-allowed');
      return;
    }

    // Extract and validate question parameter
    let question = parsedUrl.searchParams.get('question');
    
    // Handle POST requests with JSON body
    if (req.method === 'POST') {
      try {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        await new Promise((resolve, reject) => {
          req.on('end', resolve);
          req.on('error', reject);
        });
        
        if (body) {
          const parsedBody = JSON.parse(body);
          if (parsedBody.question) {
            question = parsedBody.question;
          }
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        logRequest(req, res, 'reflect invalid-json');
        return;
      }
    }
    
    if (!question || question.trim().length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'Question parameter is required' }));
      logRequest(req, res, 'reflect missing-question');
      return;
    }

    // Guard against excessively long question
    const MAX_QUESTION_LENGTH = 3072;
    if (question.length > MAX_QUESTION_LENGTH) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'Question parameter too long' }));
      logRequest(req, res, 'reflect question-too-long');
      return;
    }

    // Check if CAPTCHA should be skipped first
    const skipCaptcha = process.env.NODE_ENV === 'development' || process.env.SKIP_CAPTCHA === 'true';
    
    // Extract Turnstile token
    let turnstileToken = req.headers['x-turnstile-token'];
    
    if (turnstileToken) {
      if (Array.isArray(turnstileToken)) {
        turnstileToken = turnstileToken[0];
      } else {
        turnstileToken = String(turnstileToken);
      }
    }
    
    if (!turnstileToken) {
      turnstileToken = parsedUrl.searchParams.get('turnstileToken');
    }
    
    if (!turnstileToken && !skipCaptcha) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'CAPTCHA token is required', details: 'Missing turnstile token' }));
      logRequest(req, res, 'reflect missing-captcha-token');
      return;
    }

    // Extract client IP
    let clientIp = req.socket.remoteAddress || 'unknown';
    
    const trustProxy = process.env.WEB_TRUST_PROXY === 'true';
    if (trustProxy) {
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          clientIp = forwardedFor.split(',')[0].trim();
        } else if (Array.isArray(forwardedFor)) {
          clientIp = forwardedFor[0].trim();
        }
      }
    }
    
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }
    
    // Extract session ID
    let sessionId = parsedUrl.searchParams.get('sessionId');
    
    if (!sessionId) {
      const rawSessionId = req.headers['x-session-id'];
      if (rawSessionId) {
        let sessionIdStr = Array.isArray(rawSessionId) ? rawSessionId[0] : String(rawSessionId);
        sessionIdStr = sessionIdStr.trim().substring(0, 128);
        sessionIdStr = sessionIdStr.replace(/[^a-zA-Z0-9\-_]/g, '');
        if (sessionIdStr.length > 0) {
          sessionId = sessionIdStr;
        }
      }
    }
    
    if (!sessionId) {
      sessionId = `ip-${clientIp}`;
    }

    // Verify Turnstile token with Cloudflare
    try {
      // Skip CAPTCHA verification in development mode
      if (skipCaptcha) {
        console.log('Skipping CAPTCHA verification in development mode');
        logRequest(req, res, `reflect captcha-skipped-dev-mode ip=${clientIp}`);
      } else {
        // Debug: Log CAPTCHA verification info (without exposing sensitive data)
        console.log('CAPTCHA verification debug:');
        console.log('Token length:', turnstileToken?.length || 0);
        console.log('Secret key is set:', !!process.env.TURNSTILE_SECRET_KEY);
        
        const formData = new URLSearchParams();
        formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
        formData.append('response', turnstileToken);
        formData.append('remoteip', clientIp);
        
        const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(10000)
        });

        if (!verificationResponse.ok) {
          throw new Error(`Verification service returned ${verificationResponse.status}`);
        }

        const verificationData = await verificationResponse.json();
        
        // Debug: Log verification response
        console.log('Turnstile verification response:', JSON.stringify(verificationData, null, 2));
        
        if (!verificationData.success) {
          const errorCodes = verificationData['error-codes']?.join(', ') || 'Unknown verification error';
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ 
            error: 'CAPTCHA verification failed', 
            details: errorCodes 
          }));
          logRequest(req, res, `reflect captcha-failed ip=${clientIp} errors=${errorCodes}`);
          return;
        }

        logRequest(req, res, `reflect captcha-verified ip=${clientIp}`);
      }
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ 
        error: 'CAPTCHA verification service unavailable', 
        details: error.message 
      }));
      logRequest(req, res, `reflect captcha-service-error ${error.message}`);
      return;
    }

    // Rate limiting: Check IP first
    const ipRateLimitResult = ipRateLimiter.check(clientIp);
    if (!ipRateLimitResult.allowed) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', ipRateLimitResult.retryAfter.toString());
      res.end(JSON.stringify({ 
        error: 'Too many requests from this IP', 
        retryAfter: ipRateLimitResult.retryAfter 
      }));
      logRequest(req, res, `reflect ip-rate-limited retryAfter=${ipRateLimitResult.retryAfter}`);
      return;
    }

    // Rate limiting: Check session
    const sessionRateLimitResult = sessionRateLimiter.check(sessionId);
    if (!sessionRateLimitResult.allowed) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', sessionRateLimitResult.retryAfter.toString());
      res.end(JSON.stringify({ 
        error: 'Too many requests for this session', 
        retryAfter: sessionRateLimitResult.retryAfter 
      }));
      logRequest(req, res, `reflect session-rate-limited retryAfter=${sessionRateLimitResult.retryAfter}`);
      return;
    }

    // Generate AI response
    try {
      const systemPrompt = `You are Arete, an AI assistant that helps people think through tough questions while staying honest and fair. You explore multiple ethical perspectives, trace your sources, and show how you reach your conclusions. Be helpful, thoughtful, and transparent in your responses.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.trim() }
      ];

      const aiResponse = await openaiService.generateResponse(
        'gpt-5-mini',
        messages,
        { 
          reasoningEffort: 'low', 
          verbosity: 'low',
          channelContext: {
            channelId: sessionId
          }
        }
      );

      const { normalizedText, metadata: assistantMetadata } = aiResponse;

      // Build response metadata
      const runtimeContext = {
        modelVersion: 'gpt-5-mini',
        conversationSnapshot: `${question}\n\n${normalizedText}`
      };

      const responseMetadata = buildResponseMetadata(assistantMetadata, 'Low', runtimeContext);

      // Return successful response
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({
        message: normalizedText,
        metadata: responseMetadata
      }));
      logRequest(req, res, `reflect success questionLength=${question.length}`);
      
    } catch (openaiError) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      
      const errorResponse = {
        error: 'AI generation failed',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error'
      };
      
      res.end(JSON.stringify(errorResponse));
      logRequest(req, res, `reflect openai-error ${openaiError instanceof Error ? openaiError.message : 'unknown error'}`);
    }

  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    
    const errorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.end(JSON.stringify(errorResponse));
    logRequest(req, res, `reflect error ${error instanceof Error ? error.message : 'unknown error'}`);
  }
};

// Initialize services
try {
  initializeServices();
} catch (error) {
  console.error('Failed to initialize services:', error);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    
    // Handle /api/reflect endpoint
    if (parsedUrl.pathname === '/api/reflect') {
      await handleReflectRequest(req, res, parsedUrl);
      return;
    }
    
    // Serve static files
    const asset = await resolveAsset(req.url);

    if (!asset) {
      res.statusCode = 404;
      res.end('Not Found');
      logRequest(req, res, '(missing asset, index.html unavailable)');
      return;
    }

    const extension = path.extname(asset.absolutePath).toLowerCase();
    const contentType = MIME_MAP.get(extension) || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.end(asset.content);
    logRequest(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.end('Internal Server Error');
    logRequest(req, res, error instanceof Error ? error.message : 'unknown error');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`Simple server available on port ${port}`);
});
