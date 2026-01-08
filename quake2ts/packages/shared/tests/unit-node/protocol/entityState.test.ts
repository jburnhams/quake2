import { describe, expect, it } from 'vitest';
import type { EntityState } from '../../../src/protocol/entityState.js';

describe('protocol/entityState', () => {
  it('defines EntityState interface compatible with usage', () => {
    // This is primarily a type check, but we can verify it by creating a valid object
    const state: EntityState = {
      number: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      modelIndex: 10,
      frame: 0,
      skinNum: 0,
      effects: 0,
      renderfx: 0,
      solid: 1,
    };

    expect(state.number).toBe(1);
    expect(state.solid).toBe(1);
    expect(state.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('supports optional rerelease fields', () => {
    const state: EntityState = {
      number: 2,
      origin: { x: 10, y: 10, z: 10 },
      angles: { x: 0, y: 90, z: 0 },
      modelIndex: 5,
      frame: 1,
      skinNum: 2,
      effects: 0,
      renderfx: 0,
      solid: 0,

      // Extended fields
      alpha: 0.5,
      scale: 2.0,
      modelIndex2: 15
    };

    expect(state.alpha).toBe(0.5);
    expect(state.scale).toBe(2.0);
    expect(state.modelIndex2).toBe(15);
  });
});
