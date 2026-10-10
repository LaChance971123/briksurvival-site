import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Python is already required by the site's local, CI and Netlify build pipeline.
// This test is entirely offline; the public Census files are fetched only during
// an explicitly requested data regeneration, never during npm test or page use.
test('pinned ZIP-area artifact and lossless multimap generator pass offline checks', () => {
  const result = spawnSync('python', ['scripts/test_zip_areas.py'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
});
