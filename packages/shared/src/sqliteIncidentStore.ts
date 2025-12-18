import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const BUSY_MAX_ATTEMPTS = 5;
const BUSY_RETRY_DELAY_MS = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const incidentLogger = typeof logger.child === 'function' ? logger.child({ module: 'sqliteIncidentStore' }) : logger;

export type IncidentStatus = 'new' | 'under_review' | 'confirmed' | 'dismissed' | 'resolved';

export interface IncidentPointers {
  responseId?: string;
  traceId?: string;
  guildId?: string;
  channelId?: string;
  messageId?: string;
  jumpUrl?: string;
  modelVersion?: string;
  chainHash?: string;
  [key: string]: unknown;
}

export interface IncidentRecord {
  id: number;
  shortId: string;
  status: IncidentStatus;
  tags: string[];
  pointers: IncidentPointers;
  remediationApplied: boolean;
  remediationNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentAuditEvent {
  id: number;
  incidentId: number;
  actorHash?: string | null;
  action: string;
  notes?: string | null;
  createdAt: string;
}

export interface CreateIncidentInput {
  status?: IncidentStatus;
  tags?: string[];
  pointers?: IncidentPointers;
  remediationApplied?: boolean;
  remediationNotes?: string | null;
}

export interface AppendAuditEventInput {
  actorHash?: string | null;
  action: string;
  notes?: string | null;
}

export interface SqliteIncidentStoreConfig {
  dbPath: string;
}

export class SqliteIncidentStore {
  private readonly db: Database.Database;
  private readonly insertIncident: Database.Statement;
  private readonly updateStatusStatement: Database.Statement;
  private readonly getIncidentStatement: Database.Statement;
  private readonly insertAuditEvent: Database.Statement;

  constructor(config: SqliteIncidentStoreConfig) {
    const resolvedPath = path.resolve(config.dbPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        short_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        tags_json TEXT,
        pointers_json TEXT,
        remediation_applied INTEGER NOT NULL DEFAULT 0,
        remediation_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);

      CREATE TABLE IF NOT EXISTS incident_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id INTEGER NOT NULL,
        actor_hash TEXT,
        action TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_audit_incident_id ON incident_audit_events (incident_id);
    `);

    this.insertIncident = this.db.prepare(`
      INSERT INTO incidents (
        short_id, status, tags_json, pointers_json, remediation_applied, remediation_notes, created_at, updated_at
      ) VALUES (
        @short_id, @status, @tags_json, @pointers_json, @remediation_applied, @remediation_notes, @created_at, @updated_at
      )
    `);

    this.updateStatusStatement = this.db.prepare(`
      UPDATE incidents
      SET status = @status, updated_at = @updated_at
      WHERE id = @id
    `);

    this.getIncidentStatement = this.db.prepare(`
      SELECT id, short_id, status, tags_json, pointers_json, remediation_applied, remediation_notes, created_at, updated_at
      FROM incidents
      WHERE id = ?
      LIMIT 1
    `);

    this.insertAuditEvent = this.db.prepare(`
      INSERT INTO incident_audit_events (incident_id, actor_hash, action, notes, created_at)
      VALUES (@incident_id, @actor_hash, @action, @notes, @created_at)
    `);

    incidentLogger.info(`Initialized SQLite incident store at ${resolvedPath}`);
  }

  private assertValidStatus(status: string): asserts status is IncidentStatus {
    const allowed: IncidentStatus[] = ['new', 'under_review', 'confirmed', 'dismissed', 'resolved'];
    if (!allowed.includes(status as IncidentStatus)) {
      throw new Error(`Invalid incident status: ${status}`);
    }
  }

  private isBusyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: string }).code;
    return code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
  }

  private async withRetry<T>(operation: () => T): Promise<T> {
    for (let attempt = 1; attempt <= BUSY_MAX_ATTEMPTS; attempt++) {
      try {
        return operation();
      } catch (error) {
        if (this.isBusyError(error) && attempt < BUSY_MAX_ATTEMPTS) {
          await sleep(BUSY_RETRY_DELAY_MS * attempt);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to execute SQLite operation after retries.');
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags) {
      return [];
    }
    return tags
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }

  private generateShortId(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  private mapIncidentRow(row: any): IncidentRecord {
    return {
      id: row.id as number,
      shortId: row.short_id as string,
      status: row.status as IncidentStatus,
      tags: row.tags_json ? (JSON.parse(row.tags_json) as string[]) : [],
      pointers: row.pointers_json ? (JSON.parse(row.pointers_json) as IncidentPointers) : {},
      remediationApplied: Boolean(row.remediation_applied),
      remediationNotes: row.remediation_notes ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  async createIncident(input: CreateIncidentInput): Promise<IncidentRecord> {
    const now = new Date().toISOString();
    const tags = this.normalizeTags(input.tags);
    const status = input.status ?? 'new';
    this.assertValidStatus(status);

    const runResult = await this.withRetry(() =>
      this.insertIncident.run({
        short_id: this.generateShortId(),
        status,
        tags_json: JSON.stringify(tags),
        pointers_json: input.pointers ? JSON.stringify(input.pointers) : null,
        remediation_applied: input.remediationApplied ? 1 : 0,
        remediation_notes: input.remediationNotes ?? null,
        created_at: now,
        updated_at: now
      })
    );

    const id = Number(runResult.lastInsertRowid);
    incidentLogger.info(`Incident created (id=${id})`);
    const row = await this.withRetry(() => this.getIncidentStatement.get(id));
    return this.mapIncidentRow(row);
  }

  async getIncident(id: number): Promise<IncidentRecord | null> {
    const row = await this.withRetry(() => this.getIncidentStatement.get(id));
    if (!row) {
      return null;
    }
    return this.mapIncidentRow(row);
  }

  async updateStatus(id: number, status: IncidentStatus): Promise<void> {
    this.assertValidStatus(status);
    const updatedAt = new Date().toISOString();
    const result = await this.withRetry(() =>
      this.updateStatusStatement.run({ id, status, updated_at: updatedAt })
    );

    if (result.changes === 0) {
      throw new Error(`Incident ${id} not found`);
    }
  }

  async appendAuditEvent(incidentId: number, event: AppendAuditEventInput): Promise<IncidentAuditEvent> {
    const createdAt = new Date().toISOString();
    const runResult = await this.withRetry(() =>
      this.insertAuditEvent.run({
        incident_id: incidentId,
        actor_hash: event.actorHash ?? null,
        action: event.action,
        notes: event.notes ?? null,
        created_at: createdAt
      })
    );

    return {
      id: Number(runResult.lastInsertRowid),
      incidentId,
      actorHash: event.actorHash ?? null,
      action: event.action,
      notes: event.notes ?? null,
      createdAt
    };
  }
}
