/**
 * Simple AABB-based collision system for procedural maps
 * Provides trace() and pointContents() functions compatible with quake2ts pmove
 */
import type { Vec3 } from '@quake2ts/shared';
import { CONTENTS_SOLID, CONTENTS_NONE } from '@quake2ts/shared';
import type { PmoveTraceResult, PmoveTraceFn, PmovePointContentsFn } from '@quake2ts/shared';

export interface AABB {
  mins: Vec3;
  maxs: Vec3;
}

export interface CollisionBrush extends AABB {
  contents: number;
}

/**
 * Collision world that stores brushes and provides trace functions
 */
export class CollisionWorld {
  private brushes: CollisionBrush[] = [];

  clear(): void {
    this.brushes = [];
  }

  addBrush(mins: Vec3, maxs: Vec3, contents: number = CONTENTS_SOLID): void {
    this.brushes.push({ mins, maxs, contents });
  }

  /**
   * Add a box brush at a position with given size
   */
  addBox(center: Vec3, halfExtents: Vec3, contents: number = CONTENTS_SOLID): void {
    this.addBrush(
      { x: center.x - halfExtents.x, y: center.y - halfExtents.y, z: center.z - halfExtents.z },
      { x: center.x + halfExtents.x, y: center.y + halfExtents.y, z: center.z + halfExtents.z },
      contents
    );
  }

  /**
   * Trace a box from start to end, returns collision result
   */
  trace: PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3): PmoveTraceResult => {
    const playerMins = mins ?? { x: -16, y: -16, z: -24 };
    const playerMaxs = maxs ?? { x: 16, y: 16, z: 32 };

    let fraction = 1.0;
    let hitNormal: Vec3 | undefined;
    let hitContents: number | undefined;
    let allsolid = false;
    let startsolid = false;

    // Calculate swept AABB
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    // Check if starting in solid
    for (const brush of this.brushes) {
      if (this.boxIntersectsBrush(start, playerMins, playerMaxs, brush)) {
        startsolid = true;
        allsolid = true;
        break;
      }
    }

    // Trace against each brush
    for (const brush of this.brushes) {
      const result = this.traceBoxToBrush(start, end, playerMins, playerMaxs, brush);
      if (result.fraction < fraction) {
        fraction = result.fraction;
        hitNormal = result.normal;
        hitContents = brush.contents;
      }
    }

    // Calculate end position
    const endpos: Vec3 = {
      x: start.x + dx * fraction,
      y: start.y + dy * fraction,
      z: start.z + dz * fraction,
    };

    return {
      fraction,
      endpos,
      planeNormal: hitNormal,
      allsolid,
      startsolid,
      contents: hitContents,
    };
  };

  /**
   * Check contents at a point
   */
  pointContents: PmovePointContentsFn = (point: Vec3): number => {
    for (const brush of this.brushes) {
      if (
        point.x >= brush.mins.x && point.x <= brush.maxs.x &&
        point.y >= brush.mins.y && point.y <= brush.maxs.y &&
        point.z >= brush.mins.z && point.z <= brush.maxs.z
      ) {
        return brush.contents;
      }
    }
    return CONTENTS_NONE;
  };

  /**
   * Check if a box intersects a brush
   */
  private boxIntersectsBrush(pos: Vec3, mins: Vec3, maxs: Vec3, brush: CollisionBrush): boolean {
    return (
      pos.x + maxs.x > brush.mins.x && pos.x + mins.x < brush.maxs.x &&
      pos.y + maxs.y > brush.mins.y && pos.y + mins.y < brush.maxs.y &&
      pos.z + maxs.z > brush.mins.z && pos.z + mins.z < brush.maxs.z
    );
  }

  /**
   * Trace a box against a single brush using slab method
   */
  private traceBoxToBrush(
    start: Vec3,
    end: Vec3,
    mins: Vec3,
    maxs: Vec3,
    brush: CollisionBrush
  ): { fraction: number; normal?: Vec3 } {
    // Expand brush by player bounds (Minkowski sum)
    const expandedMins: Vec3 = {
      x: brush.mins.x + mins.x,
      y: brush.mins.y + mins.y,
      z: brush.mins.z + mins.z,
    };
    const expandedMaxs: Vec3 = {
      x: brush.maxs.x + maxs.x,
      y: brush.maxs.y + maxs.y,
      z: brush.maxs.z + maxs.z,
    };

    // Ray-AABB intersection using slab method
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    let tmin = 0;
    let tmax = 1;
    let hitNormal: Vec3 | undefined;

    // X axis
    if (Math.abs(dx) < 0.0001) {
      if (start.x < expandedMins.x || start.x > expandedMaxs.x) {
        return { fraction: 1.0 };
      }
    } else {
      const invD = 1.0 / dx;
      let t1 = (expandedMins.x - start.x) * invD;
      let t2 = (expandedMaxs.x - start.x) * invD;
      let normal: Vec3 = { x: -1, y: 0, z: 0 };
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        normal = { x: 1, y: 0, z: 0 };
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNormal = normal;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { fraction: 1.0 };
    }

    // Y axis
    if (Math.abs(dy) < 0.0001) {
      if (start.y < expandedMins.y || start.y > expandedMaxs.y) {
        return { fraction: 1.0 };
      }
    } else {
      const invD = 1.0 / dy;
      let t1 = (expandedMins.y - start.y) * invD;
      let t2 = (expandedMaxs.y - start.y) * invD;
      let normal: Vec3 = { x: 0, y: -1, z: 0 };
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        normal = { x: 0, y: 1, z: 0 };
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNormal = normal;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { fraction: 1.0 };
    }

    // Z axis
    if (Math.abs(dz) < 0.0001) {
      if (start.z < expandedMins.z || start.z > expandedMaxs.z) {
        return { fraction: 1.0 };
      }
    } else {
      const invD = 1.0 / dz;
      let t1 = (expandedMins.z - start.z) * invD;
      let t2 = (expandedMaxs.z - start.z) * invD;
      let normal: Vec3 = { x: 0, y: 0, z: -1 };
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        normal = { x: 0, y: 0, z: 1 };
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNormal = normal;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { fraction: 1.0 };
    }

    // Hit!
    if (tmin < 0) tmin = 0;
    return { fraction: tmin, normal: hitNormal };
  }
}

/**
 * Build collision brushes from a procedural room
 */
export function buildCollisionFromRoom(
  world: CollisionWorld,
  width: number,
  depth: number,
  height: number,
  wallThickness: number,
  pillars: Array<{ x: number; y: number; radius: number; height: number }>
): void {
  world.clear();

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  // Floor (thin brush at z=0)
  world.addBrush(
    { x: -halfWidth, y: -halfDepth, z: -wallThickness },
    { x: halfWidth, y: halfDepth, z: 0 },
    CONTENTS_SOLID
  );

  // Ceiling
  world.addBrush(
    { x: -halfWidth, y: -halfDepth, z: height },
    { x: halfWidth, y: halfDepth, z: height + wallThickness },
    CONTENTS_SOLID
  );

  // Walls (4 sides)
  // North wall (+Y)
  world.addBrush(
    { x: -halfWidth, y: halfDepth - wallThickness, z: 0 },
    { x: halfWidth, y: halfDepth, z: height },
    CONTENTS_SOLID
  );

  // South wall (-Y)
  world.addBrush(
    { x: -halfWidth, y: -halfDepth, z: 0 },
    { x: halfWidth, y: -halfDepth + wallThickness, z: height },
    CONTENTS_SOLID
  );

  // East wall (+X)
  world.addBrush(
    { x: halfWidth - wallThickness, y: -halfDepth, z: 0 },
    { x: halfWidth, y: halfDepth, z: height },
    CONTENTS_SOLID
  );

  // West wall (-X)
  world.addBrush(
    { x: -halfWidth, y: -halfDepth, z: 0 },
    { x: -halfWidth + wallThickness, y: halfDepth, z: height },
    CONTENTS_SOLID
  );

  // Pillars (as square brushes - simpler than cylinders)
  for (const pillar of pillars) {
    world.addBrush(
      { x: pillar.x - pillar.radius, y: pillar.y - pillar.radius, z: 0 },
      { x: pillar.x + pillar.radius, y: pillar.y + pillar.radius, z: pillar.height },
      CONTENTS_SOLID
    );
  }
}
