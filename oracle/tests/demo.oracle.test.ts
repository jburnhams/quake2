// Demo lockstep against id's own client: see demo/lockstep.ts and ../demo/demo_harness.c.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_PAK, formatReport, lockstep, runCDemo } from './demo/lockstep';

/** Every layer the TS client builds; all are equal on every frame, and the audio in every sample. The HUD and pixels come next. */
const GATED = ['timing', 'frame state', 'prediction', 'view', 'light styles', 'entity list', 'dynamic lights', 'particles', 'sound starts', 'sound channels', 'mixed audio'];
const canRun = existsSync(DEMO_PAK) && Boolean(process.env.Q2DEMO_BIN || process.env.Q2DEMO_OUT);

describe('q2demo1.dm2 in lockstep with id\'s client', () => {
  it.skipIf(!canRun)('draws what id\'s client draws, frame by frame', () => {
    const { dir, frames } = runCDemo();
    const raw = readFileSync(join(dir, 'pcm.raw'));
    const report = lockstep(frames, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
    console.log(`demo lockstep, ${report.framesRun} frames:\n${formatReport(report)}`);
    expect(report.framesRun).toBeGreaterThan(2000);
    for (const layer of report.layers) {
      if (!GATED.some((g) => layer.layer.startsWith(g))) continue;
      expect(layer.first, `${layer.layer}\n${formatReport({ ...report, layers: [layer] })}`).toBeNull();
    }
  });
});
