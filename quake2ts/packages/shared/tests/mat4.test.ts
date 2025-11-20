import { describe, expect, it } from 'vitest';
import { createMat4Identity, mat4FromBasis, multiplyMat4, transformPointMat4 } from '../src/math/mat4.js';

describe('mat4 helpers', () => {
  it('builds an identity matrix', () => {
    const ident = createMat4Identity();
    expect(Array.from(ident)).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  it('multiplies matrices in column-major order', () => {
    const a = mat4FromBasis({ x: 1, y: 2, z: 3 }, [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ]);
    const b = mat4FromBasis({ x: 1, y: 0, z: 0 }, [
      { x: 0, y: 1, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ]);

    const result = multiplyMat4(a, b);
    expect(transformPointMat4(result, { x: 0, y: 0, z: 0 })).toEqual({ x: 2, y: 2, z: 3 });
    expect(transformPointMat4(result, { x: 1, y: 0, z: 0 }).x).toBeCloseTo(2);
    expect(transformPointMat4(result, { x: 0, y: 1, z: 0 }).y).toBeCloseTo(2);
  });

  it('creates a basis matrix usable for vertex transforms', () => {
    const basis = mat4FromBasis(
      { x: 4, y: 5, z: 6 },
      [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 0 },
      ]
    );

    const point = transformPointMat4(basis, { x: 1, y: 2, z: 3 });
    expect(point).toEqual({ x: 7, y: 6, z: 8 });
  });

  it('multiplies matrices with a known result', () => {
    const a = new Float32Array([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    ]);
    const b = new Float32Array([
      17, 18, 19, 20,
      21, 22, 23, 24,
      25, 26, 27, 28,
      29, 30, 31, 32
    ]);

    const result = multiplyMat4(a, b);
    const expected = new Float32Array([
      538, 612, 686, 760,
      650, 740, 830, 920,
      762, 868, 974, 1080,
      874, 996, 1118, 1240
    ]);

    for (let i = 0; i < 16; i++) {
      expect(result[i]).toBeCloseTo(expected[i], 4);
    }
  });

  it('transforms a point with the identity matrix', () => {
    const identity = createMat4Identity();
    const point = { x: 1, y: 2, z: 3 };
    const transformed = transformPointMat4(identity, point);
    expect(transformed.x).toBeCloseTo(point.x, 4);
    expect(transformed.y).toBeCloseTo(point.y, 4);
    expect(transformed.z).toBeCloseTo(point.z, 4);
  });
});
