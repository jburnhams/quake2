/**
 * q_shared.c's vector helpers, in the C's 32-bit floats.
 *
 * The original client keeps every vector in `float` and x86-64 does float arithmetic in floats
 * (SSE), so each operation rounds to float32. These round with Math.fround after every operation,
 * the same rule the pmove and collision ports follow, so a refdef built here matches the C's
 * bit for bit. A C `double` literal (0.125, 1.0/16, M_PI) promotes the expression to double; those
 * spots say so.
 */
export const f = Math.fround;

export type Vec3 = [number, number, number];

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => [f(x), f(y), f(z)];

/** LerpAngle: the shorter way round from a2 to a1. */
export function lerpAngle(a2: number, a1: number, frac: number): number {
  if (f(a1 - a2) > 180) a1 = f(a1 - 360);
  if (f(a1 - a2) < -180) a1 = f(a1 + 360);
  return f(a2 + f(frac * f(a1 - a2)));
}

/** anglemod: ((360.0/65536) * ((int)((a)*(65536/360.0)) & 65535)), in doubles, stored as float. */
export function anglemod(a: number): number {
  return f((360.0 / 65536) * (Math.trunc(a * (65536 / 360.0)) & 65535));
}

/** AngleVectors: forward, right and up from pitch, yaw and roll in degrees. */
export function angleVectors(angles: readonly number[]): { forward: Vec3; right: Vec3; up: Vec3 } {
  const toRad = (M: number) => f(M * ((Math.PI * 2) / 360)); // float * double, stored in a float
  let angle = toRad(angles[1]);
  const sy = f(Math.sin(angle));
  const cy = f(Math.cos(angle));
  angle = toRad(angles[0]);
  const sp = f(Math.sin(angle));
  const cp = f(Math.cos(angle));
  angle = toRad(angles[2]);
  const sr = f(Math.sin(angle));
  const cr = f(Math.cos(angle));
  const forward: Vec3 = [f(cp * cy), f(cp * sy), f(-sp)];
  // (-1*sr*sp*cy+-1*cr*-sy): -1 is an int, so these stay in floats
  const right: Vec3 = [
    f(f(f(f(-1 * sr) * sp) * cy) + f(f(-1 * cr) * -sy)),
    f(f(f(f(-1 * sr) * sp) * sy) + f(f(-1 * cr) * cy)),
    f(f(-1 * sr) * cp),
  ];
  const up: Vec3 = [
    f(f(f(cr * sp) * cy) + f(f(-sr) * -sy)),
    f(f(f(cr * sp) * sy) + f(f(-sr) * cy)),
    f(cr * cp),
  ];
  return { forward, right, up };
}

/** VectorMA: a + scale * b. */
export function vectorMA(a: readonly number[], scale: number, b: readonly number[]): Vec3 {
  return [f(a[0] + f(scale * b[0])), f(a[1] + f(scale * b[1])), f(a[2] + f(scale * b[2]))];
}

/** SHORT2ANGLE: x * (360.0/65536), a double stored as float. */
export const short2angle = (x: number): number => f(x * (360.0 / 65536));

/** DotProduct, in floats. */
export const dot = (a: readonly number[], b: readonly number[]): number => f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));

/** VectorNormalize: normalizes v in place and returns its length (sqrt in doubles, stored as float). */
export function vectorNormalize(v: number[]): number {
  const length = f(Math.sqrt(dot(v, v)));
  if (length) {
    const ilength = f(1 / length);
    v[0] = f(v[0] * ilength);
    v[1] = f(v[1] * ilength);
    v[2] = f(v[2] * ilength);
  }
  return length;
}

/** VectorLength: the sum is a loop of float additions from 0. */
export function vectorLength(v: readonly number[]): number {
  let length = 0;
  for (let i = 0; i < 3; i++) length = f(length + f(v[i] * v[i]));
  return f(Math.sqrt(length));
}

/** CrossProduct. */
export const crossProduct = (a: readonly number[], b: readonly number[]): Vec3 => [
  f(f(a[1] * b[2]) - f(a[2] * b[1])),
  f(f(a[2] * b[0]) - f(a[0] * b[2])),
  f(f(a[0] * b[1]) - f(a[1] * b[0])),
];

/** VectorScale. */
export const vectorScale = (v: readonly number[], s: number): Vec3 => [f(v[0] * s), f(v[1] * s), f(v[2] * s)];

/** VectorAdd and VectorSubtract. */
export const vectorAdd = (a: readonly number[], b: readonly number[]): Vec3 => [f(a[0] + b[0]), f(a[1] + b[1]), f(a[2] + b[2])];
export const vectorSubtract = (a: readonly number[], b: readonly number[]): Vec3 => [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];

/**
 * rand() as the original Windows builds had it (the MSVC runtime's generator), seeded 1 as an
 * unseeded program is. The demo oracle builds id's client with the same generator.
 */
export class Rand {
  private holdrand = 1;
  constructor(seed = 1) { this.holdrand = seed >>> 0; }
  rand(): number {
    this.holdrand = (Math.imul(this.holdrand, 214013) + 2531011) >>> 0;
    return (this.holdrand >>> 16) & 0x7fff;
  }
  /** frand: (rand()&32767) * (1.0/32767), returned as a float. */
  frand(): number { return f((this.rand() & 32767) * (1.0 / 32767)); }
  /** crand: (rand()&32767) * (2.0/32767) - 1, returned as a float. */
  crand(): number { return f((this.rand() & 32767) * (2.0 / 32767) - 1); }
}
