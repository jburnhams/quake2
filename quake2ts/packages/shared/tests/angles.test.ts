import { describe, expect, it } from 'vitest';
import {
  AngleVectorsResult,
  angleMod,
  angleVectors,
  degToRad,
  lerpAngle,
  radToDeg,
  vectorToAngles,
  vectorToYaw,
} from '../src/index.js';

function expectVec3(result: AngleVectorsResult['forward'], expected: AngleVectorsResult['forward']) {
  expect(result.x).toBeCloseTo(expected.x);
  expect(result.y).toBeCloseTo(expected.y);
  expect(result.z).toBeCloseTo(expected.z);
}

describe('angle math helpers', () => {
  it('converts between degrees and radians', () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
  });

  it('produces forward/right/up vectors matching rerelease q_vec3', () => {
    const identity = angleVectors({ x: 0, y: 0, z: 0 });
    expectVec3(identity.forward, { x: 1, y: 0, z: 0 });
    expectVec3(identity.right, { x: 0, y: -1, z: 0 });
    expectVec3(identity.up, { x: 0, y: 0, z: 1 });

    const yaw90 = angleVectors({ x: 0, y: 90, z: 0 });
    expectVec3(yaw90.forward, { x: 0, y: 1, z: 0 });
    expectVec3(yaw90.right, { x: 1, y: 0, z: 0 });
    expectVec3(yaw90.up, { x: 0, y: 0, z: 1 });

    const pitch90 = angleVectors({ x: 90, y: 0, z: 0 });
    expectVec3(pitch90.forward, { x: 0, y: 0, z: -1 });
    expectVec3(pitch90.right, { x: 0, y: -1, z: 0 });
    expectVec3(pitch90.up, { x: 1, y: 0, z: 0 });

    const roll90 = angleVectors({ x: 0, y: 0, z: 90 });
    expectVec3(roll90.forward, { x: 1, y: 0, z: 0 });
    expectVec3(roll90.right, { x: 0, y: 0, z: -1 });
    expectVec3(roll90.up, { x: 0, y: -1, z: 0 });
  });

  it('interpolates angles with wraparound and modulo', () => {
    expect(lerpAngle(10, 350, 0.25)).toBeCloseTo(5);
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(360);
    expect(angleMod(725)).toBe(5);
    expect(angleMod(-45)).toBe(315);
  });

  it('computes yaw from vectors with the rerelease edge cases', () => {
    expect(vectorToYaw({ x: 0, y: 0, z: 0 })).toBe(0);
    expect(vectorToYaw({ x: 0, y: 5, z: 0 })).toBe(90);
    expect(vectorToYaw({ x: 0, y: -1, z: 0 })).toBe(270);
    expect(vectorToYaw({ x: 1, y: 1, z: 0 })).toBeCloseTo(45);
    expect(vectorToYaw({ x: -1, y: 1, z: 0 })).toBeCloseTo(135);
  });

  it('converts direction vectors back to Euler angles', () => {
    expect(vectorToAngles({ x: 0, y: 0, z: 1 })).toEqual({ x: -90, y: 0, z: 0 });
    expect(vectorToAngles({ x: 0, y: 0, z: -1 })).toEqual({ x: -270, y: 0, z: 0 });
    expect(vectorToAngles({ x: 1, y: 0, z: 0 })).toEqual({ x: -0, y: 0, z: 0 });

    const angled = vectorToAngles({ x: 1, y: 1, z: 1 });
    expect(angled.y).toBeCloseTo(45, 3);
    expect(angled.x).toBeCloseTo(-35.264, 3);
    expect(angled.z).toBe(0);
  });
});
