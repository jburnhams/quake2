import type { Vec3 } from '@quake2ts/shared';
import {
  type CompilePlane,
  PLANE_X,
  PLANE_Y,
  PLANE_Z,
  PLANE_ANYX,
  PLANE_ANYY,
  PLANE_ANYZ
} from '../types/index.js';

const PLANE_HASH_SIZE = 1024;

/**
 * Manages a set of unique planes for BSP compilation.
 * Handles deduplication and hashing.
 */
export class PlaneSet {
  private planes: CompilePlane[] = [];
  private hashTable: number[] = new Array(PLANE_HASH_SIZE).fill(-1);

  constructor() {
    // Plane 0 is always null/invalid plane in some contexts, but usually we just start adding.
    // However, some engines expect plane 0 to be special?
    // Quake 2 doesn't seem to enforce plane 0 specialness in the BSP format itself,
    // but tools often preserve 0 as a dummy if needed.
    // We'll start empty.
  }

  getPlanes(): CompilePlane[] {
    return this.planes;
  }

  /**
   * Finds an existing plane or adds a new one.
   * Returns the index of the plane.
   *
   * @param normal Plane normal
   * @param dist Plane distance
   */
  findOrAdd(normal: Vec3, dist: number): number {
    // Snap normal and dist to integers/epsilon if needed?
    // For now assume caller handles basic normalization.

    const hash = this.hash(normal, dist);

    // Check hash chain
    for (let i = this.hashTable[hash]; i !== -1; i = this.planes[i].hashChain!) {
      const p = this.planes[i];
      if (Math.abs(p.dist - dist) < 0.01 &&
          Math.abs(p.normal.x - normal.x) < 0.0001 &&
          Math.abs(p.normal.y - normal.y) < 0.0001 &&
          Math.abs(p.normal.z - normal.z) < 0.0001) {
        return i;
      }
    }

    // Add new plane
    const type = this.getPlaneType(normal);
    const newPlane: CompilePlane = {
      normal: { ...normal },
      dist,
      type,
      hashChain: this.hashTable[hash]
    };

    const index = this.planes.length;
    this.planes.push(newPlane);
    this.hashTable[hash] = index;

    return index;
  }

  /**
   * Determine the type of the plane (axial or non-axial).
   */
  private getPlaneType(normal: Vec3): number {
    if (normal.x === 1.0 || normal.x === -1.0) return PLANE_X;
    if (normal.y === 1.0 || normal.y === -1.0) return PLANE_Y;
    if (normal.z === 1.0 || normal.z === -1.0) return PLANE_Z;

    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);

    if (ax >= ay && ax >= az) return PLANE_ANYX;
    if (ay >= ax && ay >= az) return PLANE_ANYY;
    return PLANE_ANYZ;
  }

  private hash(normal: Vec3, dist: number): number {
    // Simple hash function matching q2tools somewhat
    let h = Math.abs(Math.floor(dist * 100)); // Discretize dist
    h += Math.abs(Math.floor(normal.x * 100));
    h += Math.abs(Math.floor(normal.y * 100));
    h += Math.abs(Math.floor(normal.z * 100));
    return h % PLANE_HASH_SIZE;
  }
}
