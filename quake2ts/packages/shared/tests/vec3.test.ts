import { describe, expect, it } from 'vitest';
import { ZERO_VEC3, addVec3, dotVec3 } from '../src/index.js';

describe('vec3 helpers', () => {
  it('adds vectors component-wise', () => {
    expect(addVec3({ x: 1, y: 2, z: -1 }, { x: -3, y: 0.5, z: 4 })).toEqual({
      x: -2,
      y: 2.5,
      z: 3,
    });
  });

  it('computes dot products', () => {
    expect(dotVec3({ x: 0, y: 1, z: 0 }, { x: 5, y: 3, z: -1 })).toBe(3);
  });

  it('exposes a constant zero vector', () => {
    expect(ZERO_VEC3).toEqual({ x: 0, y: 0, z: 0 });
  });
});
