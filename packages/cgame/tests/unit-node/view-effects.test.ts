import { describe, it, expect, beforeEach } from 'vitest';
import { ViewEffects, type ViewKick } from '../../src/view/effects.js';
import { defaultPredictionState } from '../../src/prediction/index.js';
import { PmFlag, type Vec3 } from '@quake2ts/shared';

describe('ViewEffects', () => {
  let viewEffects: ViewEffects;
  let state = defaultPredictionState();

  beforeEach(() => {
    viewEffects = new ViewEffects();
    state = defaultPredictionState();
  });

  it('should initialize with default values', () => {
    expect(viewEffects.last).toBeUndefined();
  });

  it('should apply view kick correctly', () => {
    const kick: ViewKick = { pitch: 10, roll: 5, durationMs: 100 };
    viewEffects.addKick(kick);

    // Initial sample (kick full strength)
    let sample = viewEffects.sample(state, 0);
    // Wait, sample logic applies kick based on remainingMs / durationMs.
    // If we pass 0 frameTimeMs, it should still be full strength.
    expect(sample.angles.x).toBeCloseTo(10);
    expect(sample.angles.z).toBeCloseTo(5);

    // Halfway through
    sample = viewEffects.sample(state, 50);
    // After 50ms, remaining is 50ms. ratio is 0.5.
    // However, the implementation subtracts frameTimeMs AFTER calculating ratio for the CURRENT frame?
    // Let's check implementation:
    // const ratio = Math.max(0, Math.min(1, this.kick.remainingMs / this.kick.durationMs));
    // kickPitch += ratio * this.kick.pitch;
    // this.kick.remainingMs = Math.max(0, this.kick.remainingMs - frameTimeMs);

    // So for the *next* call it will be reduced.
    // First call (above): remaining 100, ratio 1.0. then remaining becomes 100 - 0 = 100 (if frameTime is 0 passed).

    // Let's redo.
    viewEffects = new ViewEffects();
    viewEffects.addKick(kick);

    // Frame 1: 50ms elapsed
    sample = viewEffects.sample(state, 50);
    // remaining is 100. ratio is 1.0.
    expect(sample.angles.x).toBeCloseTo(10);
    expect(sample.angles.z).toBeCloseTo(5);
    // Remaining becomes 50.

    // Frame 2: Another 50ms elapsed
    sample = viewEffects.sample(state, 50);
    // remaining is 50. ratio is 0.5.
    expect(sample.angles.x).toBeCloseTo(5);
    expect(sample.angles.z).toBeCloseTo(2.5);
    // Remaining becomes 0.

    // Frame 3: Another 50ms elapsed
    sample = viewEffects.sample(state, 50);
    // Kick should be gone or 0.
    expect(sample.angles.x).toBeCloseTo(0);
    expect(sample.angles.z).toBeCloseTo(0);
  });

  it('should calculate bobbing when moving on ground', () => {
    state.velocity = { x: 300, y: 0, z: 0 };
    state.pmFlags = PmFlag.OnGround; // Assume 1 is OnGround, or check constant.
    // Wait, PmFlag is an enum (likely bits).
    // Let's assume PmFlag.OnGround is handled correctly by helper.
    // Actually, let's verify PmFlag values or use the import.
    // state.pmFlags is number.

    // Correct way to set flag:
    state.pmFlags = PmFlag.OnGround;

    // Simulate a few frames
    const sample1 = viewEffects.sample(state, 50);
    const sample2 = viewEffects.sample(state, 50);
    const sample3 = viewEffects.sample(state, 50);

    // We expect some bobbing (z offset or angles changing)
    // Angles: pitch/roll tilt based on velocity + bob.
    // Offset: z based on bob.

    // Just verify that it's not all zero.
    const hasBob = sample1.offset.z !== 0 || sample2.offset.z !== 0 || sample3.offset.z !== 0;
    expect(hasBob).toBe(true);

    // Verify velocity tilt
    // runPitch default 0.002. Velocity 300.
    // dotVec3(velocity, forward). If viewangles 0, forward is x:1.
    // 300 * 0.002 = 0.6 pitch tilt.
    // Plus bob effects.

    expect(sample1.angles.x).not.toBe(0);
  });

  it('should not bob when in air', () => {
    state.velocity = { x: 300, y: 0, z: 0 };
    state.pmFlags = 0; // Not on ground

    const sample = viewEffects.sample(state, 100);

    // Bob height should be 0.
    expect(sample.offset.z).toBe(0);

    // Velocity tilt still applies? Implementation:
    // let pitchTilt = dotVec3(state.velocity, forward) * this.settings.runPitch;
    // Yes.
    expect(sample.angles.x).not.toBe(0);
  });
});
