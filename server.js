/*
 * Simple Node static file server that ships with the Docker image.
 * We host the Vite build output from packages/web/dist and
 * fall back to index.html for client-side routing support. The script
 * intentionally avoids external dependencies so the runtime image stays small.
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Dynamically import the trace store since it is published as an ES module.
let traceStoreModule = null;

// Resolve the directory containing the built frontend assets.
const DIST_DIR = path.join(__dirname, 'packages', 'web', 'dist');

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
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] ${req.method} ${req.url} -> ${res.statusCode} ${extra}`);
};

(async () => {
  try {
    traceStoreModule = await import('@arete/shared');
    // eslint-disable-next-line no-console
    console.log('Trace store loaded successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load trace store:', error);
  }
})();

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  let traceLogNote = '';
  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const traceMatch = /^\/trace\/([A-Za-z0-9_-]+)(\.json)?$/.exec(parsedUrl.pathname);

    if (traceMatch) {
      const responseId = traceMatch[1];
      const wantsJson = Boolean(traceMatch[2]);

      if (!traceStoreModule) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end('Trace store not yet initialized');
        logRequest(req, res, `trace responseId=${responseId} store-unavailable`);
        return;
      }

      const traceStore = traceStoreModule.defaultTraceStore;
      if (!traceStore || typeof traceStore.retrieve !== 'function') {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end('Trace store unavailable');
        logRequest(req, res, `trace responseId=${responseId} invalid-store`);
        return;
      }

      let metadata = null;
      try {
        metadata = await traceStore.retrieve(responseId);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end('Failed to load trace');
        logRequest(
          req,
          res,
          `trace responseId=${responseId} retrieval-error ${error instanceof Error ? error.message : 'unknown error'}`
        );
        return;
      }

      if (!metadata) {
        if (wantsJson) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end('Trace not found');
          logRequest(req, res, `trace responseId=${responseId} not-found-json`);
          return;
        }

        traceLogNote = `trace responseId=${responseId} not-found-forwarded`;
      }

      const staleAfter = metadata?.staleAfter ? new Date(metadata.staleAfter) : null;
      const isStale =
        staleAfter && Number.isFinite(staleAfter.getTime()) && Date.now() > staleAfter.getTime();

      if (isStale) {
        if (wantsJson) {
          res.statusCode = 410;
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          const json = JSON.stringify(
            {
              message: 'Trace has expired',
              metadata,
            },
            (key, value) => (value instanceof URL ? value.toString() : value),
            2
          );
          res.end(json);
          logRequest(req, res, `trace responseId=${responseId} stale-json`);
          return;
        }

        traceLogNote = `trace responseId=${responseId} stale-forwarded`;
      }

      const hashParam = parsedUrl.searchParams.get('hash');
      if (metadata && hashParam && hashParam !== metadata.chainHash) {
        if (wantsJson) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end('Chain hash mismatch');
          logRequest(req, res, `trace responseId=${responseId} hash-mismatch-json expected=${metadata.chainHash} provided=${hashParam}`);
          return;
        }

        traceLogNote = `trace responseId=${responseId} hash-mismatch-forwarded expected=${metadata.chainHash} provided=${hashParam}`;
      }

      if (wantsJson) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        const json = JSON.stringify(
          metadata,
          (key, value) => (value instanceof URL ? value.toString() : value),
          2
        );
        res.end(json);
        logRequest(req, res, `trace responseId=${responseId} served-json`);
        return;
      }

      if (!traceLogNote) {
        traceLogNote = `trace responseId=${responseId} forwarded-to-spa`;
      }
    }

    const asset = await resolveAsset(req.url);

    if (!asset) {
      res.statusCode = 404;
      res.end('Not Found');
      const extra = traceLogNote
        ? `${traceLogNote}; missing asset, index.html unavailable`
        : '(missing asset, index.html unavailable)';
      logRequest(req, res, extra);
      return;
    }

    const extension = path.extname(asset.absolutePath).toLowerCase();
    const contentType = MIME_MAP.get(extension) || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.end(asset.content);
    logRequest(req, res, traceLogNote);
  } catch (error) {
    res.statusCode = 500;
    res.end('Internal Server Error');
    logRequest(req, res, error instanceof Error ? error.message : 'unknown error');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Static site available on port ${port}`);
});
