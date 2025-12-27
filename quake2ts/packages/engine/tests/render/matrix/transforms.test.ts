import { describe, expect, test } from 'vitest';
import { vec3 } from 'gl-matrix';
import {
  quakeToWebGL,
  quakeToWebGPU,
  webGLToQuake,
  webGPUToQuake
} from '../../../src/render/matrix/transforms.js';

function expectVec3ToEqual(a: vec3, b: vec3) {
  // Use toBeCloseTo to handle -0 vs 0 issues
  expect(a[0]).toBeCloseTo(b[0]);
  expect(a[1]).toBeCloseTo(b[1]);
  expect(a[2]).toBeCloseTo(b[2]);
}

describe('Coordinate Transforms', () => {
  test('quakeToWebGL transforms correctly', () => {
    // X -> -Z
    expectVec3ToEqual(quakeToWebGL([1, 0, 0]), vec3.fromValues(0, 0, -1));
    // Y -> -X
    expectVec3ToEqual(quakeToWebGL([0, 1, 0]), vec3.fromValues(-1, 0, 0));
    // Z -> Y
    expectVec3ToEqual(quakeToWebGL([0, 0, 1]), vec3.fromValues(0, 1, 0));
  });

  test('quakeToWebGPU transforms correctly', () => {
    // Note: WebGPU uses same view space coordinate system as WebGL (RH, -Z forward)
    // X -> -Z
    expectVec3ToEqual(quakeToWebGPU([1, 0, 0]), vec3.fromValues(0, 0, -1));
    // Y -> -X
    expectVec3ToEqual(quakeToWebGPU([0, 1, 0]), vec3.fromValues(-1, 0, 0));
    // Z -> Y
    expectVec3ToEqual(quakeToWebGPU([0, 0, 1]), vec3.fromValues(0, 1, 0));
  });

  test('webGLToQuake is inverse of quakeToWebGL', () => {
    const v = vec3.fromValues(10, 20, 30);
    const gl = quakeToWebGL(v);
    const back = webGLToQuake(gl);
    expectVec3ToEqual(back, v);
  });

  test('webGPUToQuake is inverse of quakeToWebGPU', () => {
    const v = vec3.fromValues(10, 20, 30);
    const wgpu = quakeToWebGPU(v);
    const back = webGPUToQuake(wgpu);
    expectVec3ToEqual(back, v);
  });
});
