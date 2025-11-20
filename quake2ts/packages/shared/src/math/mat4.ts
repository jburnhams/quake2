import { Vec3 } from './vec3.js';

export type Mat4 = Float32Array;

export function createMat4Identity(): Mat4 {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function multiplyMat4(a: Float32Array, b: Float32Array): Mat4 {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

export function transformPointMat4(mat: Float32Array, point: Vec3): Vec3 {
  const x = point.x;
  const y = point.y;
  const z = point.z;
  return {
    x: mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
    y: mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
    z: mat[2] * x + mat[6] * y + mat[10] * z + mat[14],
  };
}

export function mat4FromBasis(origin: Vec3, axis: readonly [Vec3, Vec3, Vec3]): Mat4 {
  const out = createMat4Identity();
  out[0] = axis[0].x;
  out[1] = axis[0].y;
  out[2] = axis[0].z;

  out[4] = axis[1].x;
  out[5] = axis[1].y;
  out[6] = axis[1].z;

  out[8] = axis[2].x;
  out[9] = axis[2].y;
  out[10] = axis[2].z;

  out[12] = origin.x;
  out[13] = origin.y;
  out[14] = origin.z;

  return out;
}
