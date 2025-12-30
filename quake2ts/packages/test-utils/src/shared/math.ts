import type { Vec3, Bounds3 } from '@quake2ts/shared/math/vec3';

/**
 * Creates a Vector3 object.
 *
 * @param x - The X coordinate (default: 0).
 * @param y - The Y coordinate (default: 0).
 * @param z - The Z coordinate (default: 0).
 * @returns A Vec3 object.
 */
export const createVector3 = (x: number = 0, y: number = 0, z: number = 0): Vec3 => ({
  x,
  y,
  z,
});

/**
 * Creates a bounds object (min/max vectors).
 *
 * @param mins - The minimum bounds vector (default: 0,0,0).
 * @param maxs - The maximum bounds vector (default: 1,1,1).
 * @returns A Bounds3 object.
 */
export const createBounds = (
  mins: Vec3 = createVector3(0, 0, 0),
  maxs: Vec3 = createVector3(1, 1, 1)
): Bounds3 => ({
  mins,
  maxs,
});

/**
 * Interface representing a transformation (position, rotation, scale).
 */
export interface Transform {
    position: Vec3;
    rotation: Vec3; // Euler angles
    scale: Vec3;
}

/**
 * Creates a Transform object.
 *
 * @param overrides - Optional overrides for transform properties.
 * @returns A Transform object.
 */
export const createTransform = (overrides?: Partial<Transform>): Transform => ({
    position: createVector3(),
    rotation: createVector3(),
    scale: createVector3(1, 1, 1),
    ...overrides
});

/**
 * Generates a random Vector3 within the specified range.
 *
 * @param min - Minimum value for each component (default: -100).
 * @param max - Maximum value for each component (default: 100).
 * @returns A random Vec3 object.
 */
export const randomVector3 = (min: number = -100, max: number = 100): Vec3 => ({
    x: Math.random() * (max - min) + min,
    y: Math.random() * (max - min) + min,
    z: Math.random() * (max - min) + min,
});

export { ZERO_VEC3 } from '@quake2ts/shared/math/vec3';
