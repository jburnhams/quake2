export type Color4 = [number, number, number, number];

/**
 * TypeScript port of G_AddBlend from rerelease q_std.h.
 *
 * Given an incoming RGBA color and an existing blend color, computes the new
 * blended color where alpha is accumulated and RGB is mixed proportionally
 * to the previous vs. new alpha contribution.
 *
 * This function is pure and does not mutate its inputs.
 */
export function addBlendColor(
  r: number,
  g: number,
  b: number,
  a: number,
  current: Color4,
): Color4 {
  if (a <= 0) {
    return current;
  }

  const oldR = current[0];
  const oldG = current[1];
  const oldB = current[2];
  const oldA = current[3];

  const a2 = oldA + (1 - oldA) * a;

  if (a2 <= 0) {
    return [0, 0, 0, 0];
  }

  const a3 = oldA / a2;

  const newR = oldR * a3 + r * (1 - a3);
  const newG = oldG * a3 + g * (1 - a3);
  const newB = oldB * a3 + b * (1 - a3);

  return [newR, newG, newB, a2];
}

