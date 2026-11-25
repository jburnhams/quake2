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

export function mat4Identity(out: Mat4 = new Float32Array(16)): Mat4 {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
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

export function mat4Ortho(out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = near * nf;
  out[15] = 1;

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

export function mat4Translate(out: Mat4, v: Vec3): Mat4 {
  const x = v.x, y = v.y, z = v.z;
  out[12] = out[0] * x + out[4] * y + out[8] * z + out[12];
  out[13] = out[1] * x + out[5] * y + out[9] * z + out[13];
  out[14] = out[2] * x + out[6] * y + out[10] * z + out[14];
  out[15] = out[3] * x + out[7] * y + out[11] * z + out[15];
  return out;
}

export function mat4Perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovy / 2);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[15] = 0;
  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
}
