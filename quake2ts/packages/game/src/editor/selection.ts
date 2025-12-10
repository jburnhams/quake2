import { Entity } from '../entities/entity';
import { EntitySystem } from '../entities/system';
import { vec3 } from 'gl-matrix';
import { BoundingBox } from '@quake2ts/shared';

export interface EntityHit {
  entity: Entity;
  distance: number;
  point: vec3;
  normal: vec3;
}

export interface Ray {
  origin: vec3;
  direction: vec3;
}

/**
 * Casts a ray into the entity world and returns all entities intersected by the ray.
 * The results are sorted by distance from the ray origin.
 */
export function rayCastEntities(
  entities: EntitySystem,
  ray: Ray
): EntityHit[] {
  const hits: EntityHit[] = [];
  const MAX_DISTANCE = 8192; // Typical Quake max distance

  entities.forEachEntity((entity) => {
    // Basic AABB check first
    if (!entity.inuse) return;

    // Use absmin/absmax if available, otherwise calculate from origin + mins/maxs
    const bounds: BoundingBox = {
      mins: entity.absmin,
      maxs: entity.absmax
    };

    const intersection = intersectRayAABB(ray, bounds);

    if (intersection) {
      // If we have a hit, we might want to do more precise checks (BSP/Mesh)
      // For now, AABB is the baseline requirement.
      if (intersection.distance < MAX_DISTANCE) {
         hits.push({
           entity,
           distance: intersection.distance,
           point: intersection.point,
           normal: intersection.normal
         });
      }
    }
  });

  return hits.sort((a, b) => a.distance - b.distance);
}

function intersectRayAABB(
  ray: Ray,
  aabb: BoundingBox
): { distance: number; point: vec3; normal: vec3 } | null {
  const tmin = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  const tmax = vec3.fromValues(Infinity, Infinity, Infinity);

  const invDir = vec3.create();
  vec3.set(invDir, 1 / ray.direction[0], 1 / ray.direction[1], 1 / ray.direction[2]);

  for (let i = 0; i < 3; i++) {
    const t1 = (aabb.mins[i] - ray.origin[i]) * invDir[i];
    const t2 = (aabb.maxs[i] - ray.origin[i]) * invDir[i];

    tmin[i] = Math.min(t1, t2);
    tmax[i] = Math.max(t1, t2);
  }

  const tNear = Math.max(Math.max(tmin[0], tmin[1]), tmin[2]);
  const tFar = Math.min(Math.min(tmax[0], tmax[1]), tmax[2]);

  if (tNear > tFar || tFar < 0) {
    return null;
  }

  const distance = tNear > 0 ? tNear : tFar; // if tNear < 0, we are inside

  if (distance < 0) return null; // Behind us

  const point = vec3.create();
  vec3.scaleAndAdd(point, ray.origin, ray.direction, distance);

  // Calculate normal
  const normal = vec3.create();
  const epsilon = 0.001;

  // A crude way to determine normal for AABB
  if (Math.abs(point[0] - aabb.mins[0]) < epsilon) normal[0] = -1;
  else if (Math.abs(point[0] - aabb.maxs[0]) < epsilon) normal[0] = 1;
  else if (Math.abs(point[1] - aabb.mins[1]) < epsilon) normal[1] = -1;
  else if (Math.abs(point[1] - aabb.maxs[1]) < epsilon) normal[1] = 1;
  else if (Math.abs(point[2] - aabb.mins[2]) < epsilon) normal[2] = -1;
  else if (Math.abs(point[2] - aabb.maxs[2]) < epsilon) normal[2] = 1;

  return { distance, point, normal };
}
