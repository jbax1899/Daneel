/**
 * @arete-module: TraceStore
 * @arete-risk: moderate
 * @arete-ethics: critical
 * @arete-scope: utility
 *
 * @description
 * Shared helpers and factory for persistence of response provenance metadata.
 *
 * @impact
 * Risk: Storage failures can break audit trails and transparency features.
 * Ethics: Controls trace storage and audit trail management. Ensures all AI responses are traceable and auditable, supporting transparency and accountability.
 */

import type { ResponseMetadata } from 'ethics-core';
import { logger } from './logger.js';
import { SqliteTraceStore } from './sqliteTraceStore.js';

export type TraceStore = SqliteTraceStore;

export const traceStoreJsonReplacer = (_key: string, value: unknown) => {
  if (value instanceof URL) {
    return value.toString();
  }

  return value;
};

const traceStoreLogger = typeof logger.child === 'function' ? logger.child({ module: 'traceStore' }) : logger;

export function assertValidResponseMetadata(
  value: unknown,
  source: string,
  responseId: string
): asserts value is ResponseMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (expected object).`);
  }

  const record = value as Record<string, unknown>;
  const requiredStringFields: Array<keyof ResponseMetadata> = [
    'responseId',
    'chainHash',
    'staleAfter',
    'licenseContext',
    'modelVersion',
    'provenance',
    'riskTier'
  ];

  for (const field of requiredStringFields) {
    if (typeof record[field] !== 'string' || (record[field] as string).length === 0) {
      throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (missing field ${field}).`);
    }
  }

  if (typeof record.tradeoffCount !== 'number') {
    throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (tradeoffCount must be number).`);
  }

  if (typeof record.confidence !== 'number') {
    throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (confidence must be number).`);
  }

  if (!Array.isArray(record.citations)) {
    throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (citations must be an array).`);
  }

  for (const citation of record.citations) {
    if (!citation || typeof citation !== 'object') {
      throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (citation must be object).`);
    }

    const citationRecord = citation as Record<string, unknown>;

    if (typeof citationRecord.title !== 'string') {
      throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (citation title missing).`);
    }

    if (!(citationRecord.url instanceof URL)) {
      throw new Error(`Trace record "${source}" for response "${responseId}" is invalid (citation URL missing).`);
    }
  }
}

export function createTraceStoreFromEnv(): TraceStore {
  const backend = process.env.PROVENANCE_BACKEND?.trim().toLowerCase();
  if (backend && backend !== 'sqlite') {
    throw new Error(`Unsupported PROVENANCE_BACKEND "${backend}". Only "sqlite" is supported.`);
  }

  const envPath = process.env.PROVENANCE_SQLITE_PATH?.trim();
  const flyDefaultPath = process.env.FLY_APP_NAME ? '/data/provenance.db' : undefined;
  const defaultPath = envPath || flyDefaultPath || './data/provenance.db';

  try {
    return new SqliteTraceStore({ dbPath: defaultPath });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const isPermission = code === 'EACCES' || code === 'EPERM';
    if (isPermission && !envPath) {
      // Fallback to a local relative path when default path is not writable and no env override is set.
      traceStoreLogger.warn(
        `Falling back to local SQLite path "./data/provenance.db" because default path "${defaultPath}" was not writable: ${String(error)}`
      );
      return new SqliteTraceStore({ dbPath: './data/provenance.db' });
    }
    throw error;
  }
}

export const defaultTraceStore = createTraceStoreFromEnv();
