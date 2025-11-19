import { describe, expect, it } from 'vitest';
import {
  ZERO_VEC3,
  STOP_EPSILON,
  addPointToBounds,
  addVec3,
  boxesIntersect,
  clipVelocityVec3,
  clipVelocityAgainstPlanes,
  closestPointToBox,
  concatRotationMatrices,
  createEmptyBounds3,
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
  projectSourceVec3,
  projectSourceVec3WithUp,
  rotatePointAroundVector,
  scaleVec3,
  slerpVec3,
  slideClipVelocityVec3,
  subtractVec3,
} from '../src/index.js';
import type { Mat3, Vec3 } from '../src/index.js';

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
    expect(projectPointOnPlane({ x: 3, y: 4, z: 5 }, { x: 0, y: 0, z: 2 })).toEqual({ x: 3, y: 4, z: 0 });

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

  it('clears bounds and expands them like q_vec3::ClearBounds/AddPointToBounds', () => {
    let bounds = createEmptyBounds3();
    expect(bounds.mins.x).toBe(Number.POSITIVE_INFINITY);
    expect(bounds.maxs.z).toBe(Number.NEGATIVE_INFINITY);

    bounds = addPointToBounds({ x: 5, y: -2, z: 3 }, bounds);
    expect(bounds).toEqual({ mins: { x: 5, y: -2, z: 3 }, maxs: { x: 5, y: -2, z: 3 } });

    bounds = addPointToBounds({ x: -4, y: 10, z: -8 }, bounds);
    expect(bounds).toEqual({ mins: { x: -4, y: -2, z: -8 }, maxs: { x: 5, y: 10, z: 3 } });

    const other = {
      mins: { x: 5, y: 10, z: 3 },
      maxs: { x: 6, y: 12, z: 5 },
    } satisfies { mins: Vec3; maxs: Vec3 };

    expect(boxesIntersect(bounds, other)).toBe(true);
    expect(
      boxesIntersect(bounds, {
        mins: { x: 6.01, y: 10, z: 3 },
        maxs: { x: 8, y: 12, z: 5 },
      }),
    ).toBe(false);
  });

  it('clips velocity against planes like q_vec3::ClipVelocity', () => {
    const inVel = { x: 0, y: 0, z: -10 };
    const normal = { x: 0, y: 0, z: 1 };

    // Perfect bounce with overbounce 2 should invert and preserve magnitude
    const bounced = clipVelocityVec3(inVel, normal, 2);
    expect(bounced).toEqual({ x: 0, y: 0, z: 10 });

    // Very small velocities get zeroed using STOP_EPSILON
    const tinyVel = { x: 0, y: 0, z: STOP_EPSILON * 0.2 };
    const clippedTiny = clipVelocityVec3(tinyVel, normal, 1);
    expect(clippedTiny).toEqual(ZERO_VEC3);
  });

  it('resolves velocity against multiple clip planes like PM_StepSlideMove_Generic', () => {
    const velocity = { x: 10, y: -5, z: 0 };
    const floor = { x: 0, y: 0, z: 1 };
    const wall = { x: 0, y: 1, z: 0 };

    // With two planes, the result should travel along their shared crease (X axis here).
    const crease = clipVelocityAgainstPlanes(velocity, [floor, wall], 1.01, velocity);
    expect(crease.y).toBe(0);
    expect(crease.z).toBe(0);
    expect(crease.x).not.toBe(0);

    // If the crease velocity points against the primal direction, it should be clamped to zero.
    const backwards = clipVelocityAgainstPlanes(
      { x: -5, y: -5, z: 0 },
      [floor, wall],
      1.01,
      velocity,
    );
    expect(backwards).toEqual(ZERO_VEC3);
  });

  it('slides velocity along planes like q_vec3::SlideClipVelocity', () => {
    const inVel = { x: 5, y: 0, z: -5 };
    const normal = { x: 0, y: 0, z: 1 };

    const slid = slideClipVelocityVec3(inVel, normal, 1);
    // Z component should be removed, X component preserved
    expect(slid.x).toBeCloseTo(5);
    expect(slid.y).toBeCloseTo(0);
    expect(slid.z).toBe(0);

    // Components that end up within +/- STOP_EPSILON should clamp to zero
    const nearlyZero = slideClipVelocityVec3({ x: STOP_EPSILON * 0.5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1);
    expect(nearlyZero.x).toBe(0);
  });

  it('projects weapon offsets like G_ProjectSource and G_ProjectSource2', () => {
    const point = { x: 10, y: 20, z: 30 };
    const distance = { x: 5, y: 2, z: 3 };
    const forward = { x: 1, y: 0, z: 0 };
    const right = { x: 0, y: 1, z: 0 };
    const up = { x: 0, y: 0, z: 1 };

    const projected = projectSourceVec3(point, distance, forward, right);
    expect(projected).toEqual({ x: 15, y: 22, z: 33 });

    const projectedWithUp = projectSourceVec3WithUp(point, distance, forward, right, up);
    expect(projectedWithUp).toEqual({ x: 15, y: 22, z: 33 });

    // Non-orthogonal basis should still behave linearly
    const diagonalForward = normalizeVec3({ x: 1, y: 1, z: 0 });
    const diagonalRight = normalizeVec3({ x: -1, y: 1, z: 0 });
    const basisProjected = projectSourceVec3(point, distance, diagonalForward, diagonalRight);
    // The distance.x term moves along diagonalForward, distance.y along diagonalRight
    expect(lengthVec3(subtractVec3(basisProjected, point))).toBeCloseTo(
      lengthVec3({
        x: diagonalForward.x * distance.x + diagonalRight.x * distance.y,
        y: diagonalForward.y * distance.x + diagonalRight.y * distance.y,
        z: distance.z,
      }),
    );
  });

  it('slerps direction vectors like q_vec3::slerp', () => {
    const from = normalizeVec3({ x: 1, y: 0, z: 0 });
    const to = normalizeVec3({ x: 0, y: 1, z: 0 });

    const halfway = slerpVec3(from, to, 0.5);
    // The halfway direction between X+ and Y+ is the 45-degree diagonal
    const expected = normalizeVec3({ x: 1, y: 1, z: 0 });
    expect(halfway.x).toBeCloseTo(expected.x, 4);
    expect(halfway.y).toBeCloseTo(expected.y, 4);
    expect(halfway.z).toBeCloseTo(expected.z, 4);

    // For nearly-parallel vectors, slerp should reduce to nlerp
    const almost = slerpVec3(from, normalizeVec3({ x: 1, y: 0.001, z: 0 }), 0.5);
    expect(lengthVec3(almost)).toBeCloseTo(1, 4);
  });

  it('concatenates rotation matrices like q_vec3::R_ConcatRotations', () => {
    const identity: Mat3 = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const rotZ90: Mat3 = [
      [0, 1, 0],
      [-1, 0, 0],
      [0, 0, 1],
    ];

    const applied = concatRotationMatrices(identity, rotZ90);
    expect(applied).toEqual(rotZ90);

    const rotZ180 = concatRotationMatrices(rotZ90, rotZ90);
    expect(rotZ180[0][0]).toBeCloseTo(-1, 4);
    expect(rotZ180[1][1]).toBeCloseTo(-1, 4);
    expect(rotZ180[2][2]).toBeCloseTo(1, 4);
  });

  it('rotates points around vectors like q_vec3::RotatePointAroundVector', () => {
    const axis = normalizeVec3({ x: 0, y: 0, z: 1 });
    const point = { x: 1, y: 0, z: 0 };
    const rotated = rotatePointAroundVector(axis, point, 90);
    expect(rotated.x).toBeCloseTo(0, 4);
    expect(rotated.y).toBeCloseTo(1, 4);
    expect(rotated.z).toBeCloseTo(0, 4);

    const diagonalAxis = normalizeVec3({ x: 1, y: 1, z: 0 });
    const up = { x: 0, y: 0, z: 1 };
    const flipped = rotatePointAroundVector(diagonalAxis, up, 180);
    expect(lengthVec3(flipped)).toBeCloseTo(1, 4);
    const restored = rotatePointAroundVector(diagonalAxis, flipped, -180);
    expect(restored.x).toBeCloseTo(up.x, 4);
    expect(restored.y).toBeCloseTo(up.y, 4);
    expect(restored.z).toBeCloseTo(up.z, 4);

    const unchanged = rotatePointAroundVector(ZERO_VEC3, point, 45);
    expect(unchanged).toEqual(point);
  });
});
