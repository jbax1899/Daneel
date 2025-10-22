import test from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createTraceStore } from '../src/traceStore.js';
import type { ResponseMetadata } from 'ethics-core';

test('TraceStore round trips metadata with citation URLs', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-store-'));
  const storagePath = path.join(tempRoot, 'traces');
  const store = createTraceStore({ storagePath });

  const metadata: ResponseMetadata = {
    responseId: 'response_123',
    provenance: 'Retrieved',
    confidence: 0.85,
    riskTier: 'Low',
    tradeoffCount: 2,
    chainHash: 'abc123',
    licenseContext: 'MIT',
    modelVersion: 'gpt-4.1-mini',
    staleAfter: new Date().toISOString(),
    citations: [
      {
        title: 'Example Source',
        url: new URL('https://example.com/article'),
        snippet: 'Example snippet'
      }
    ]
  };

  try {
    await store.upsert(metadata);

    const persistedPath = path.join(storagePath, `${metadata.responseId}.json`);
    const persistedContent = await fs.readFile(persistedPath, 'utf-8');
    const persistedJson = JSON.parse(persistedContent);

    assert.equal(typeof persistedJson.citations[0].url, 'string', 'citation URL should persist as a string');
    assert.equal(persistedJson.citations[0].url, metadata.citations[0].url.toString(), 'persisted URL should match original string');

    const retrieved = await store.retrieve(metadata.responseId);
    assert.ok(retrieved, 'retrieve should return stored metadata');
    assert.equal(retrieved.responseId, metadata.responseId);
    assert.equal(retrieved.chainHash, metadata.chainHash);
    assert.ok(retrieved.citations[0].url instanceof URL, 'citation URL should revive to URL instance');
    assert.equal(retrieved.citations[0].url.href, metadata.citations[0].url.href, 'revived URL should match original');

    await store.delete(metadata.responseId);
    await assert.rejects(
      fs.access(persistedPath),
      { code: 'ENOENT' },
      'deleted trace should not exist on disk'
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
