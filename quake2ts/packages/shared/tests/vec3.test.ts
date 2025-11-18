import { describe, expect, it } from 'vitest';
import {
  ZERO_VEC3,
  addVec3,
  closestPointToBox,
  crossVec3,
  distanceBetweenBoxesSquared,
  dotVec3,
  lengthVec3,
  lengthSquaredVec3,
  multiplyVec3,
  negateVec3,
  normalizeVec3,
  perpendicularVec3,
  projectPointOnPlane,
  scaleVec3,
  subtractVec3,
} from '../src/index.js';

describe('vec3 helpers', () => {
  it('adds and subtracts vectors component-wise', () => {
    expect(addVec3({ x: 1, y: 2, z: -1 }, { x: -3, y: 0.5, z: 4 })).toEqual({
      x: -2,
      y: 2.5,
      z: 3,
    });
    expect(subtractVec3({ x: 5, y: -1, z: 2 }, { x: 2, y: 3, z: -6 })).toEqual({
      x: 3,
      y: -4,
      z: 8,
    });
  });

  it('supports component multiplication, scaling, and negation', () => {
    expect(multiplyVec3({ x: 2, y: -3, z: 4 }, { x: -1, y: 0.5, z: 0.25 })).toEqual({
      x: -2,
      y: -1.5,
      z: 1,
    });
    expect(scaleVec3({ x: 3, y: -2, z: 4 }, 0.25)).toEqual({ x: 0.75, y: -0.5, z: 1 });
    expect(negateVec3({ x: 1, y: -2, z: 3 })).toEqual({ x: -1, y: 2, z: -3 });
  });

  it('computes dot and cross products', () => {
    expect(dotVec3({ x: 0, y: 1, z: 0 }, { x: 5, y: 3, z: -1 })).toBe(3);
    expect(crossVec3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(crossVec3({ x: 2, y: 3, z: 4 }, { x: -1, y: 5, z: 2 })).toEqual({ x: -14, y: -8, z: 13 });
  });

  it('computes lengths and normalization with rerelease semantics', () => {
    const v = { x: 3, y: 4, z: 12 };
    expect(lengthSquaredVec3(v)).toBe(169);
    expect(lengthVec3(v)).toBe(13);
    expect(normalizeVec3(v)).toEqual({ x: 3 / 13, y: 4 / 13, z: 12 / 13 });
    // Zero vectors remain unchanged to mirror q_vec3::normalized behavior
    expect(normalizeVec3(ZERO_VEC3)).toBe(ZERO_VEC3);
  });

  it('projects points onto planes and finds perpendicular vectors', () => {
    expect(projectPointOnPlane({ x: 3, y: 4, z: 5 }, { x: 0, y: 0, z: 2 })).toEqual({ x: 3, y: 4, z: 3.75 });

    const normal = normalizeVec3({ x: 1, y: 1, z: 1 });
    const perpendicular = perpendicularVec3(normal);
    const dot = dotVec3(normal, perpendicular);
    expect(Math.abs(dot)).toBeLessThan(1e-6);
    expect(Math.abs(lengthVec3(perpendicular) - 1)).toBeLessThan(1e-6);
  });

  it('clamps positions to box bounds and measures separation', () => {
    expect(closestPointToBox({ x: 5, y: -2, z: 3 }, { x: -1, y: -1, z: 1 }, { x: 4, y: 2, z: 5 })).toEqual({
      x: 4,
      y: -1,
      z: 3,
    });

    const aMins = { x: -1, y: -1, z: -1 };
    const aMaxs = { x: 1, y: 1, z: 1 };
    const bMins = { x: 4, y: 0, z: 0 };
    const bMaxs = { x: 6, y: 1, z: 2 };
    // Boxes are separated by 3 units along X, share the Y/Z spans
    expect(distanceBetweenBoxesSquared(aMins, aMaxs, bMins, bMaxs)).toBe(9);

    // Overlapping boxes have zero separation
    expect(distanceBetweenBoxesSquared(aMins, aMaxs, { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 })).toBe(0);
  });
});
