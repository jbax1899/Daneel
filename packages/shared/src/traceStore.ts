/**
 * @arete-module: TraceStore
 * @arete-risk: moderate
 * @arete-ethics: critical
 * @arete-scope: utility
 *
 * @description
 * Manages trace storage and retrieval for AI interactions. Handles metadata persistence and trace management.
 *
 * @impact
 * Risk: Storage failures can break audit trails and transparency features. Uses atomic file operations to prevent corruption.
 * Ethics: Controls trace storage and audit trail management. Ensures all AI responses are traceable and auditable, supporting transparency and accountability.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { ResponseMetadata } from 'ethics-core';

const RENAME_MAX_ATTEMPTS = 5;
const RENAME_RETRY_DELAY_MS = 20;
const RETRYABLE_RENAME_ERRORS = new Set(['EPERM', 'EBUSY']);
const LOCK_MAX_ATTEMPTS = 5;
const LOCK_RETRY_DELAY_MS = 25;
const LOCK_STALE_THRESHOLD_MS = 2 * 60 * 1000; // Two minutes.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const traceStoreJsonReplacer = (_key: string, value: unknown) => {
  if (value instanceof URL) {
    return value.toString();
  }

  return value;
};

function assertValidResponseMetadata(
  value: unknown,
  filePath: string,
  responseId: string
): asserts value is ResponseMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (expected object).`);
  }

  const record = value as Record<string, unknown>;
  const requiredStringFields: Array<keyof ResponseMetadata> = [
    'responseId',
    'chainHash',
    'staleAfter',
    'licenseContext',
    'modelVersion'
  ];

  for (const field of requiredStringFields) {
    if (typeof record[field] !== 'string' || (record[field] as string).length === 0) {
      throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (missing field ${field}).`);
    }
  }

  if (typeof record.tradeoffCount !== 'number') {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (tradeoffCount must be number).`);
  }

  if (typeof record.confidence !== 'number') {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (confidence must be number).`);
  }

  if (typeof record.provenance !== 'string') {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (provenance must be string).`);
  }

  if (typeof record.riskTier !== 'string') {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (riskTier must be string).`);
  }

  if (!Array.isArray(record.citations)) {
    throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (citations must be an array).`);
  }

  for (const citation of record.citations) {
    if (!citation || typeof citation !== 'object') {
      throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (citation must be object).`);
    }

    const citationRecord = citation as Record<string, unknown>;

    if (typeof citationRecord.title !== 'string') {
      throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (citation title missing).`);
    }

    if (!(citationRecord.url instanceof URL)) {
      throw new Error(`Trace file "${filePath}" for response "${responseId}" is invalid (citation URL missing).`);
    }
  }
}

/**
 * Configuration options for {@link TraceStore}.
 */
export interface TraceStoreConfig {
  /**
   * Directory where response metadata traces will be written and read from.
   */
  storagePath: string;
}

/**
 * Simple file-based persistence layer for {@link ResponseMetadata} objects.
 * Uses atomic JSON writes to avoid corruption during concurrent or crashed writes.
 */
export class TraceStore {
  private readonly config: TraceStoreConfig;

  /**
   * @param config Describes where trace files are stored on disk.
   */
  constructor(config: TraceStoreConfig) {
    this.config = config;
  }

  /**
   * Ensures the storage directory exists prior to writing.
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.storagePath, { recursive: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'EEXIST') {
        throw new Error(`Failed to prepare trace storage directory: ${nodeError.message}`);
      }
    }
  }

  /**
   * Resolves the file path for a given response identifier.
   * @throws {Error} If the responseId contains unsupported characters.
   */
  private getFilePath(responseId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(responseId)) {
      throw new Error(`Invalid responseId "${responseId}". Only alphanumeric characters, hyphens, and underscores are allowed.`);
    }

    return path.join(this.config.storagePath, `${responseId}.json`);
  }

  /**
   * Inserts or updates the persisted metadata for a response.
   * Employs per-response advisory lock files (with a two minute staleness threshold) to
   * serialize concurrent writers before performing an atomic temp-file rename.
   * @param metadata Metadata to persist.
   * @throws {Error} When the filesystem operation fails.
   */
  async upsert(metadata: ResponseMetadata): Promise<void> {
    const filePath = this.getFilePath(metadata.responseId);
    await this.ensureStorageDirectory();

    const lockPath = `${filePath}.lock`;
    let lockHandle: fs.FileHandle | null = null;

    // Acquire an advisory lock to serialize concurrent writers targeting the same response.
    for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt++) {
      try {
        lockHandle = await fs.open(lockPath, 'wx');
        break;
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === 'EEXIST') {
          let isStale = false;
          try {
            const stats = await fs.stat(lockPath);
            if (Date.now() - stats.mtimeMs > LOCK_STALE_THRESHOLD_MS) {
              isStale = true;
            }
          } catch (statError) {
            const statErr = statError as NodeJS.ErrnoException;
            if (statErr.code === 'ENOENT') {
              continue;
            }
          }

          if (isStale) {
            await fs.unlink(lockPath).catch(() => {
              // Another writer may have removed the stale lock already.
            });
            continue;
          }

          if (attempt < LOCK_MAX_ATTEMPTS) {
            await sleep(LOCK_RETRY_DELAY_MS * attempt);
            continue;
          }
        }

        const message = nodeError.message ?? String(nodeError);
        throw new Error(`Failed to acquire trace lock for response "${metadata.responseId}": ${message}`);
      }
    }

    if (!lockHandle) {
      throw new Error(`Failed to acquire trace lock for response "${metadata.responseId}".`);
    }

    try {
      const normalizedCitations = metadata.citations.map((citation) => {
        if (!citation || typeof citation !== 'object') {
          throw new Error(`Invalid citation entry for response "${metadata.responseId}".`);
        }

        let url: URL;
        if (citation.url instanceof URL) {
          url = citation.url;
        } else if (typeof citation.url === 'string') {
          try {
            url = new URL(citation.url);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to normalize citation URL for response "${metadata.responseId}": ${message}`);
          }
        } else {
          throw new Error(
            `Cannot serialize citation URL for response "${metadata.responseId}". Expected string or URL instance.`
          );
        }

        return {
          ...citation,
          url
        };
      });

      const serializableMetadata = {
        ...metadata,
        citations: normalizedCitations
      };

      const payload = JSON.stringify(serializableMetadata, traceStoreJsonReplacer, 2);
      const tempFilePath = `${filePath}.${crypto.randomUUID()}.tmp`;

      try {
        await fs.writeFile(tempFilePath, payload, { encoding: 'utf-8' });

        let renameAttempt = 0;
        while (true) {
          try {
            await fs.rename(tempFilePath, filePath);
            break;
          } catch (renameError) {
            const nodeError = renameError as NodeJS.ErrnoException;

            if (nodeError.code === 'EEXIST') {
              await fs.rm(filePath, { force: true }).catch(() => {
                // If removal fails we'll surface the subsequent rename error.
              });

              try {
                await fs.rename(tempFilePath, filePath);
                break;
              } catch (retryError) {
                throw retryError;
              }
            }

            renameAttempt += 1;

            if (
              renameAttempt >= RENAME_MAX_ATTEMPTS ||
              !nodeError.code ||
              !RETRYABLE_RENAME_ERRORS.has(nodeError.code)
            ) {
              throw renameError;
            }

            await sleep(RENAME_RETRY_DELAY_MS * renameAttempt);
          }
        }
      } catch (error) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Best-effort cleanup of the temporary file; lingering temp files can be pruned later.
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to persist trace for response "${metadata.responseId}": ${message}`);
      }
    } finally {
      // Always release the advisory lock to avoid blocking future writers.
      if (lockHandle) {
        try {
          await lockHandle.close();
        } catch {
          // Ignore close errors; lock removal below will surface issues if necessary.
        }
      }

      await fs.unlink(lockPath).catch(() => {
        // Ignore unlink errors; lock files may have been cleaned up by other recovery logic.
      });
    }
  }

  /**
   * Retrieves persisted metadata for a response.
   * @param responseId Identifier used when the metadata was stored.
   * @returns The stored metadata, or null when no file exists.
   * @throws {Error} When the file contents are corrupt or the read fails unexpectedly.
   */
  async retrieve(responseId: string): Promise<ResponseMetadata | null> {
    const filePath = this.getFilePath(responseId);

    try {
      const raw = await fs.readFile(filePath, { encoding: 'utf-8' });
      try {
        const parsed = JSON.parse(raw) as unknown;

        if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { citations?: unknown }).citations)) {
          throw new Error(`Trace file "${filePath}" is corrupted: missing citations array.`);
        }

        const citations = (parsed as { citations: unknown[] }).citations;
        // Rehydrate citation URLs now that the raw JSON has been parsed.
        for (const citation of citations) {
          if (!citation || typeof citation !== 'object') {
            throw new Error(`Trace file "${filePath}" is corrupted: citation entry is invalid.`);
          }

          const citationRecord = citation as Record<string, unknown>;

          if (typeof citationRecord.url === 'string') {
            try {
              citationRecord.url = new URL(citationRecord.url);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              throw new Error(`Trace file "${filePath}" is corrupted: invalid citation URL (${message}).`);
            }
          } else if (!(citationRecord.url instanceof URL)) {
            throw new Error(`Trace file "${filePath}" is corrupted: citation URL missing.`);
          }
        }

        assertValidResponseMetadata(parsed, filePath, responseId);
        if ((parsed as ResponseMetadata).responseId !== responseId) {
          throw new Error(
            `Trace file "${filePath}" is corrupted: responseId mismatch (expected "${responseId}" but found "${(parsed as ResponseMetadata).responseId}").`
          );
        }
        return parsed as ResponseMetadata;
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`Trace file "${filePath}" is corrupted: ${message}`);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return null;
      }

      const message = nodeError.message ?? String(nodeError);
      throw new Error(`Failed to read trace for response "${responseId}": ${message}`);
    }
  }

  /**
   * Removes the stored metadata for a response if it exists.
   * Deletion failures are logged but do not throw to keep call-sites resilient.
   * @param responseId Identifier whose metadata should be deleted.
   */
  async delete(responseId: string): Promise<void> {
    const filePath = this.getFilePath(responseId);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return;
      }

      const message = nodeError.message ?? String(nodeError);
      console.error(`Failed to delete trace for response "${responseId}": ${message}`);
    }
  }
}

/**
 * Creates a new trace store instance with optional configuration overrides.
 * @param config Custom configuration for the store; defaults to a traces directory in cwd.
 */
export function createTraceStore(config?: TraceStoreConfig): TraceStore {
  const storagePath = path.resolve(config?.storagePath ?? './traces');
  return new TraceStore({ storagePath });
}

const envStoragePath = process.env.TRACE_STORE_PATH?.trim();
const defaultStoragePath = path.resolve(
  envStoragePath && envStoragePath.length > 0 ? envStoragePath : './traces'
);

/**
 * Default trace store instance using environment configuration.
 */
export const defaultTraceStore = createTraceStore({ storagePath: defaultStoragePath });
