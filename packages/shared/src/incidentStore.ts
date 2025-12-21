/**
 * @arete-module: IncidentStoreFactory
 * @arete-risk: high
 * @arete-ethics: high
 * @arete-scope: storage
 *
 * @description
 * Factory for creating the incident store with environment-driven configuration.
 * Validates the pseudonymization secret so we never persist raw Discord IDs.
 *
 * @impact
 * Risk: Misconfiguration can block incident storage or lead to inconsistent data.
 * Ethics: Prevents raw Discord identifiers from being stored without hashing.
 */
import { logger } from './logger.js';
import { SqliteIncidentStore } from './sqliteIncidentStore.js';

const incidentStoreLogger = typeof logger.child === 'function' ? logger.child({ module: 'incidentStore' }) : logger;

export type IncidentStore = SqliteIncidentStore;

export function createIncidentStoreFromEnv(): IncidentStore {
  const backend = process.env.INCIDENT_BACKEND?.trim().toLowerCase();
  if (backend && backend !== 'sqlite') {
    throw new Error(`Unsupported INCIDENT_BACKEND "${backend}". Only "sqlite" is supported.`);
  }

  const pseudonymizationSecret = process.env.INCIDENT_PSEUDONYMIZATION_SECRET?.trim();
  if (!pseudonymizationSecret) {
    throw new Error('Missing required environment variable: INCIDENT_PSEUDONYMIZATION_SECRET');
  }

  const envPath = process.env.INCIDENT_SQLITE_PATH?.trim();
  const flyDefaultPath = process.env.FLY_APP_NAME ? '/data/incidents.db' : undefined;
  const defaultPath = envPath || flyDefaultPath || './data/incidents.db';

  try {
    return new SqliteIncidentStore({ dbPath: defaultPath, pseudonymizationSecret });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const isPermission = code === 'EACCES' || code === 'EPERM';
    if (isPermission && !envPath) {
      incidentStoreLogger.warn(
        `Falling back to local SQLite path "./data/incidents.db" because default path "${defaultPath}" was not writable: ${String(error)}`
      );
      return new SqliteIncidentStore({ dbPath: './data/incidents.db', pseudonymizationSecret });
    }
    throw error;
  }
}

export const defaultIncidentStore = createIncidentStoreFromEnv();
export type { IncidentAuditEvent, IncidentPointers, IncidentRecord, IncidentStatus } from './sqliteIncidentStore.js';
