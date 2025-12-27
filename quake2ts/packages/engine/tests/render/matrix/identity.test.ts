import { describe, expect, test } from 'vitest';
import { mat4 } from 'gl-matrix';
import { IdentityMatrixBuilder } from '../../../src/render/matrix/identity.js';

describe('IdentityMatrixBuilder', () => {
  test('returns simple matrices without coordinate transforms', () => {
    const builder = new IdentityMatrixBuilder();
    const state = {
      position: [10, 20, 30],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1,
      near: 1,
      far: 1000
    };

    const view = builder.buildViewMatrix(state);

    // With 0 rotation, view matrix should just be translation
    // In Quake space, translation is just -pos
    expect(view[12]).toBeCloseTo(-10);
    expect(view[13]).toBeCloseTo(-20);
    expect(view[14]).toBeCloseTo(-30);

    // Diagonal should be 1
    expect(view[0]).toBeCloseTo(1);
    expect(view[5]).toBeCloseTo(1);
    expect(view[10]).toBeCloseTo(1);
  });
});
