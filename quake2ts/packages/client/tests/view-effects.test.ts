import { describe, expect, it } from 'vitest';
import { PmFlag, ZERO_VEC3 } from '@quake2ts/shared';
import { ViewEffects } from '../src/view-effects.js';

function makeState(overrides: Partial<import('../src/prediction.js').PredictionState> = {}) {
  return {
    origin: ZERO_VEC3,
    velocity: ZERO_VEC3,
    viewangles: ZERO_VEC3,
    pmFlags: PmFlag.OnGround,
    pmType: 0,
    waterlevel: 0,
    gravity: 800,
    deltaAngles: ZERO_VEC3,
    ...overrides,
  } as import('../src/prediction.js').PredictionState;
}

describe('ViewEffects', () => {
  it('matches rerelease bob timing cadence on ground', () => {
    const effects = new ViewEffects();
    const state = makeState({ velocity: { x: 180, y: 0, z: 0 } });

    const first = effects.sample(state, 25);
    expect(first.bobFracSin).toBeGreaterThan(0);

    const second = effects.sample(state, 25);
    expect(second.bobFracSin).toBeGreaterThan(first.bobFracSin);
  });

  it('tilts view pitch and roll from velocity and bobbing', () => {
    const effects = new ViewEffects();
    const state = makeState({ viewangles: { x: 0, y: 0, z: 0 }, velocity: { x: 300, y: 50, z: 0 } });

    const sample = effects.sample(state, 25);

    expect(sample.angles.x).toBeGreaterThan(0); // forward speed increases pitch
    expect(sample.angles.z).not.toBe(0); // strafe adds roll
    expect(sample.offset.z).toBeGreaterThan(0); // bob height applied
  });

  it('amplifies bobbing while crouched and clamps magnitude', () => {
    const effects = new ViewEffects();
    const state = makeState({ pmFlags: PmFlag.OnGround | PmFlag.Ducked, velocity: { x: 220, y: 0, z: 0 } });

    const sample = effects.sample(state, 25);
    const forwardPitch = state.velocity.x * 0.002;
    const bobPitch = sample.angles.x - forwardPitch;

    expect(bobPitch).toBeLessThanOrEqual(1.2);
    expect(sample.angles.z).toBeGreaterThanOrEqual(-1.2);
    expect(sample.offset.z).toBeLessThanOrEqual(6);
  });

  it('decays kick angles over the configured duration', () => {
    const effects = new ViewEffects();
    const state = makeState();

    effects.addKick({ pitch: 4, roll: -3, durationMs: 100 });
    const first = effects.sample(state, 20);
    const second = effects.sample(state, 40);
    const third = effects.sample(state, 60);

    expect(first.angles.x).toBeGreaterThan(second.angles.x);
    expect(second.angles.x).toBeGreaterThan(third.angles.x);
    expect(Math.abs(third.angles.z)).toBeLessThan(Math.abs(first.angles.z));
  });
});
