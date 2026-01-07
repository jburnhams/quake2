import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('combined: red background in single evaluate', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Clear to red
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  `, {
    name: 'combined-red',
    description: 'Red background from combined evaluate',
    width: 256,
    height: 256,
    snapshotDir
  });
});
