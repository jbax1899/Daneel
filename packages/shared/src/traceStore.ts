/**
 * @arete-module: TraceStore
 * @arete-risk: moderate
 * @arete-ethics: high
 * @arete-scope: utility
 *
 * @description: Shared helpers and factory for persistence of response provenance metadata.
 *
 * @impact
 * Risk: Storage failures can break audit trails and transparency features.
 * Ethics: Controls trace storage and audit trail management. Ensures all AI responses are traceable and auditable, supporting transparency and accountability.
 */

import { logger } from './logger.js';
import { SqliteTraceStore } from './sqliteTraceStore.js';
import { assertValidResponseMetadata, traceStoreJsonReplacer } from './traceStoreUtils.js';

export type TraceStore = SqliteTraceStore;

const traceStoreLogger = typeof logger.child === 'function' ? logger.child({ module: 'traceStore' }) : logger;

export { assertValidResponseMetadata, traceStoreJsonReplacer };

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

