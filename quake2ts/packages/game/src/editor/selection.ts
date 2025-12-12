import { Entity } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { vec3 } from 'gl-matrix';
import { Bounds3, scaleVec3 } from '@quake2ts/shared';

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
    if (!entity.inUse) return;

    // Check if it is a brush model and we have traceModel capability
    if (entity.model && entity.model.startsWith('*') && entities.traceModel) {
      const end = vec3.create();
      vec3.scaleAndAdd(end, ray.origin, ray.direction, MAX_DISTANCE);

      const trace = entities.traceModel(entity,
        { x: ray.origin[0], y: ray.origin[1], z: ray.origin[2] },
        { x: end[0], y: end[1], z: end[2] }
      );

      if (trace.fraction < 1.0) {
         // Convert result back to gl-matrix vec3
         const point = vec3.fromValues(trace.endpos.x, trace.endpos.y, trace.endpos.z);
         const normal = trace.plane ? vec3.fromValues(trace.plane.normal.x, trace.plane.normal.y, trace.plane.normal.z) : vec3.create();

         const distance = trace.fraction * MAX_DISTANCE; // approximate distance

         hits.push({
           entity,
           distance,
           point,
           normal
         });
         return;
      }
    }

    // Fallback or Standard AABB check

    // Use absmin/absmax if available, otherwise calculate from origin + mins/maxs
    // Convert to Bounds3 format (expects {x,y,z}, entity has gl-matrix vec3)
    const bounds: Bounds3 = {
      mins: { x: entity.absmin.x, y: entity.absmin.y, z: entity.absmin.z },
      maxs: { x: entity.absmax.x, y: entity.absmax.y, z: entity.absmax.z }
    };

    const intersection = intersectRayAABB(ray, bounds);

    if (intersection) {
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
  aabb: Bounds3
): { distance: number; point: vec3; normal: vec3 } | null {
  const tmin = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  const tmax = vec3.fromValues(Infinity, Infinity, Infinity);

  const invDir = vec3.create();
  vec3.set(invDir, 1 / ray.direction[0], 1 / ray.direction[1], 1 / ray.direction[2]);

  // Bounds3 uses .x, .y, .z. Ray/vec3 uses [0], [1], [2].
  const mins = [aabb.mins.x, aabb.mins.y, aabb.mins.z];
  const maxs = [aabb.maxs.x, aabb.maxs.y, aabb.maxs.z];

  for (let i = 0; i < 3; i++) {
    const t1 = (mins[i] - ray.origin[i]) * invDir[i];
    const t2 = (maxs[i] - ray.origin[i]) * invDir[i];

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
  if (Math.abs(point[0] - mins[0]) < epsilon) normal[0] = -1;
  else if (Math.abs(point[0] - maxs[0]) < epsilon) normal[0] = 1;
  else if (Math.abs(point[1] - mins[1]) < epsilon) normal[1] = -1;
  else if (Math.abs(point[1] - maxs[1]) < epsilon) normal[1] = 1;
  else if (Math.abs(point[2] - mins[2]) < epsilon) normal[2] = -1;
  else if (Math.abs(point[2] - maxs[2]) < epsilon) normal[2] = 1;

  return { distance, point, normal };
}
