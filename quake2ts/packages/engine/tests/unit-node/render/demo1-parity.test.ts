/**
 * The two backends draw demo1 from the same prepared data, so their committed baselines must
 * match each other, not only their own history. Runs on the PNGs alone (no GPU).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadPNG, compareSnapshots } from '@quake2ts/test-utils';
import { DEMO1_SHOTS, SNAPSHOT_DIR, SHOT_WIDTH, SHOT_HEIGHT } from '../../demo1/shots.js';

const baseline = (backend: string, name: string) => path.join(SNAPSHOT_DIR, 'baselines', `${backend}-${name}.png`);

describe('demo1 WebGL and WebGPU parity', () => {
  for (const shot of DEMO1_SHOTS) {
    const haveBoth = fs.existsSync(baseline('webgl', shot.name)) && fs.existsSync(baseline('webgpu', shot.name));
    it.skipIf(!haveBoth)(`${shot.name} matches across backends`, async () => {
      const webgl = await loadPNG(baseline('webgl', shot.name));
      const webgpu = await loadPNG(baseline('webgpu', shot.name));
      const result = await compareSnapshots(webgl.data, webgpu.data, SHOT_WIDTH, SHOT_HEIGHT, { threshold: 0.1, maxDifferencePercent: 0.5 });
      console.log(`parity ${shot.name}: ${result.percentDifferent.toFixed(3)}% differ`);
      expect(result.percentDifferent).toBeLessThanOrEqual(0.5);
    });
  }
});
