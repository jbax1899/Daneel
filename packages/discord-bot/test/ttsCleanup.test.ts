import test from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { cleanupTTSFile } from '../src/utils/MessageProcessor.js';

const { promises: fsp } = fs;

test('cleanupTTSFile removes generated speech files without throwing on missing files', async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tts-cleanup-'));
  const speechPath = path.join(tmpDir, 'sample.mp3');

  try {
    await fsp.writeFile(speechPath, 'test');

    await cleanupTTSFile(speechPath);

    await assert.rejects(fsp.access(speechPath), (error: NodeJS.ErrnoException) => {
      assert.equal(error.code, 'ENOENT');
      return true;
    });

    await cleanupTTSFile(speechPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

