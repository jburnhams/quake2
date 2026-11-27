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
