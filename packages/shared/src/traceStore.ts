import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ResponseMetadata } from 'ethics-core';

const RENAME_MAX_ATTEMPTS = 5;
const RENAME_RETRY_DELAY_MS = 20;
const RETRYABLE_RENAME_ERRORS = new Set(['EPERM', 'EBUSY', 'EEXIST']);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const traceStoreJsonReplacer = (_key: string, value: unknown) => {
  if (value instanceof URL) {
    return value.toString();
  }

  return value;
};

const traceStoreJsonReviver = (key: string, value: unknown) => {
  if (key === 'url') {
    if (typeof value !== 'string') {
      throw new Error(`Invalid trace citation URL type: expected string but received ${typeof value}`);
    }

    return new URL(value);
  }

  return value;
};

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
   * @param metadata Metadata to persist.
   * @throws {Error} When the filesystem operation fails.
   */
  async upsert(metadata: ResponseMetadata): Promise<void> {
    const filePath = this.getFilePath(metadata.responseId);
    await this.ensureStorageDirectory();

    const serializableMetadata = {
      ...metadata,
      citations: metadata.citations.map((citation) => {
        if (!(citation.url instanceof URL)) {
          throw new Error(
            `Cannot serialize citation URL for response "${metadata.responseId}". The url must be a URL instance.`
          );
        }

        return {
          ...citation,
          url: citation.url.toString()
        };
      })
    };

    const payload = JSON.stringify(serializableMetadata, traceStoreJsonReplacer, 2);
    const tempFilePath = `${filePath}.${crypto.randomUUID()}.tmp`;

    try {
      await fs.writeFile(tempFilePath, payload, { encoding: 'utf-8' });

      let renameAttempt = 0;
      // Retry renames to mitigate transient Windows locking issues.
      while (true) {
        try {
          await fs.rename(tempFilePath, filePath);
          break;
        } catch (renameError) {
          const nodeError = renameError as NodeJS.ErrnoException;

           if (nodeError.code === 'EEXIST') {
             await fs.unlink(filePath).catch(() => {
               // The destination may not exist or could be locked; retry loop will handle subsequent errors.
             });
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
        // Ignore cleanup failures
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to persist trace for response "${metadata.responseId}": ${message}`);
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
        const parsed = JSON.parse(raw, traceStoreJsonReviver);
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
