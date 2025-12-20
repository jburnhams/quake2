import type { Vec3, Bounds3 } from '@quake2ts/shared/math/vec3';

export const createVector3 = (x: number = 0, y: number = 0, z: number = 0): Vec3 => ({
  x,
  y,
  z,
});

export const createBounds = (
  mins: Vec3 = createVector3(0, 0, 0),
  maxs: Vec3 = createVector3(1, 1, 1)
): Bounds3 => ({
  mins,
  maxs,
});

export interface Transform {
    position: Vec3;
    rotation: Vec3; // Euler angles
    scale: Vec3;
}

export const createTransform = (overrides?: Partial<Transform>): Transform => ({
    position: createVector3(),
    rotation: createVector3(),
    scale: createVector3(1, 1, 1),
    ...overrides
});

export const randomVector3 = (min: number = -100, max: number = 100): Vec3 => ({
    x: Math.random() * (max - min) + min,
    y: Math.random() * (max - min) + min,
    z: Math.random() * (max - min) + min,
});
