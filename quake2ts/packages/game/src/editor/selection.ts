import { Entity } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { Bounds3, angleVectors } from '@quake2ts/shared';

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
    if (!entity.inUse) return;

    // 1. Check if it is a brush model and we have traceModel capability
    if (entity.model && entity.model.startsWith('*') && entities.traceModel) {
      const end = vec3.create();
      vec3.scaleAndAdd(end, ray.origin, ray.direction, MAX_DISTANCE);

      const trace = entities.traceModel(entity,
        { x: ray.origin[0], y: ray.origin[1], z: ray.origin[2] },
        { x: end[0], y: end[1], z: end[2] }
      );

      if (trace.fraction < 1.0) {
         const point = vec3.fromValues(trace.endpos.x, trace.endpos.y, trace.endpos.z);
         const normal = trace.plane ? vec3.fromValues(trace.plane.normal.x, trace.plane.normal.y, trace.plane.normal.z) : vec3.create();
         const distance = trace.fraction * MAX_DISTANCE;

         hits.push({
           entity,
           distance,
           point,
           normal
         });
         return;
      }
    }

    // 2. Perform Broadphase AABB Check (using absmin/absmax)
    const bounds: Bounds3 = {
      mins: { x: entity.absmin.x, y: entity.absmin.y, z: entity.absmin.z },
      maxs: { x: entity.absmax.x, y: entity.absmax.y, z: entity.absmax.z }
    };

    // Fallback if absmin/absmax are invalid (e.g. not linked)
    if (bounds.mins.x === 0 && bounds.maxs.x === 0 && bounds.mins.y === 0) { // Naive check
        // Compute loose bounds or skip?
        // If not linked, it might not be in the world.
        // But let's trust absmin/absmax are managed by linkentity.
    }

    const broadphase = intersectRayAABB(ray, bounds);

    // If we missed the broadphase AABB, we definitely missed the entity.
    if (!broadphase || broadphase.distance >= MAX_DISTANCE) {
        return;
    }

    // 3. Perform Precise OBB Check if entity has rotation
    const hasRotation = entity.angles.x !== 0 || entity.angles.y !== 0 || entity.angles.z !== 0;

    if (hasRotation) {
        const obbHit = intersectRayOBB(ray, entity, MAX_DISTANCE);
        if (obbHit) {
            hits.push(obbHit);
        }
    } else {
        // If no rotation, the AABB result is (mostly) sufficient,
        // assuming absmin matches origin+mins.
        // Note: absmin logic in Q2 is origin + mins.
        // So we can use the broadphase result directly.

        // However, we should re-calculate against origin+mins/maxs just to be sure
        // we aren't hitting "slop" if absmin includes extra padding (it usually doesn't).
        // Let's just use the broadphase result for unrotated entities as it checked absmin.
        // Or better: Re-check against specific mins/maxs+origin to be clean.

        // Let's refine the hit using local mins/maxs + origin (which is effectively AABB).
        // This ensures if absmin was "loose" (it shouldn't be), we are precise.

        const localBounds: Bounds3 = {
            mins: { x: entity.origin.x + entity.mins.x, y: entity.origin.y + entity.mins.y, z: entity.origin.z + entity.mins.z },
            maxs: { x: entity.origin.x + entity.maxs.x, y: entity.origin.y + entity.maxs.y, z: entity.origin.z + entity.maxs.z }
        };
        const preciseAABB = intersectRayAABB(ray, localBounds);
        if (preciseAABB && preciseAABB.distance < MAX_DISTANCE) {
            hits.push({
                entity,
                ...preciseAABB
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
  // Handle division by zero safely? Infinity is fine for intersection logic usually.
  vec3.set(invDir, 1 / ray.direction[0], 1 / ray.direction[1], 1 / ray.direction[2]);

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

function intersectRayOBB(
    ray: Ray,
    entity: Entity,
    maxDistance: number
): EntityHit | null {
    // 1. Construct World Matrix for the Entity
    // Position
    const origin = vec3.fromValues(entity.origin.x, entity.origin.y, entity.origin.z);

    // Rotation (Quake 2 Angles -> Basis Vectors)
    const { forward, right, up } = angleVectors(entity.angles);

    // Q2 Coordinate System:
    // X = Forward
    // Y = Left (so Right vector is -Y axis in Local space?)
    // Z = Up
    //
    // The matrix columns should be the basis vectors.
    // However, angleVectors returns 'right' which points to the right.
    // If Q2 local Y is Left, then Local Y axis = -Right.
    //
    // Let's verify standard Q2 model rotation.
    // Models in Q2 are usually oriented X-forward.
    //
    // Basis Vectors:
    // X axis = forward
    // Y axis = -right (Left)
    // Z axis = up

    const mat = mat4.create();

    // Set columns
    // Col 0: Forward
    mat[0] = forward.x; mat[1] = forward.y; mat[2] = forward.z; mat[3] = 0;

    // Col 1: Left (-Right)
    mat[4] = -right.x; mat[5] = -right.y; mat[6] = -right.z; mat[7] = 0;

    // Col 2: Up
    mat[8] = up.x; mat[9] = up.y; mat[10] = up.z; mat[11] = 0;

    // Col 3: Translation
    mat[12] = origin[0]; mat[13] = origin[1]; mat[14] = origin[2]; mat[15] = 1;

    // 2. Invert to get WorldToLocal
    const invMat = mat4.create();
    mat4.invert(invMat, mat);

    // 3. Transform Ray to Local Space
    const localOrigin = vec3.create();
    vec3.transformMat4(localOrigin, ray.origin, invMat);

    // Transform direction (ignore translation)
    const localDir = vec3.create();
    // Use upper 3x3 of invMat for direction
    // Or just transform (origin + dir) - origin
    const temp = vec3.create();
    vec3.add(temp, ray.origin, ray.direction);
    vec3.transformMat4(temp, temp, invMat);
    vec3.sub(localDir, temp, localOrigin);
    // Normalize logic not needed if we keep scale 1?
    // Ray direction is usually normalized. Local direction might not be if scaling existed (but here scale is 1).

    // 4. Intersect with Local AABB (mins/maxs)
    const localBounds: Bounds3 = {
        mins: { x: entity.mins.x, y: entity.mins.y, z: entity.mins.z },
        maxs: { x: entity.maxs.x, y: entity.maxs.y, z: entity.maxs.z }
    };

    const intersection = intersectRayAABB({ origin: localOrigin, direction: localDir }, localBounds);

    if (!intersection || intersection.distance >= maxDistance) {
        return null;
    }

    // 5. Transform hit point and normal back to World Space
    // Hit Point
    const worldPoint = vec3.create();
    vec3.transformMat4(worldPoint, intersection.point, mat);

    // Normal (rotate only)
    const worldNormal = vec3.create();
    // Transform normal by rotation part of matrix (upper 3x3)
    // For orthogonal matrix (rotation only), this is fine.
    // intersection.normal is in local space

    // We can use transformMat4 with w=0 for direction/normal?
    // Or just manual multiplication.
    // Using upper 3x3:
    // x' = m00*x + m04*y + m08*z
    // y' = m01*x + m05*y + m09*z
    // z' = m02*x + m06*y + m10*z

    const nx = intersection.normal[0];
    const ny = intersection.normal[1];
    const nz = intersection.normal[2];

    worldNormal[0] = mat[0] * nx + mat[4] * ny + mat[8] * nz;
    worldNormal[1] = mat[1] * nx + mat[5] * ny + mat[9] * nz;
    worldNormal[2] = mat[2] * nx + mat[6] * ny + mat[10] * nz;

    // Distance?
    // Distance in local space (if scale is 1) == Distance in world space.
    // Let's verify.
    // distance = |point - origin|.
    // |worldPoint - ray.origin| == |localPoint - localOrigin|? Yes, if rigid transform.

    return {
        entity,
        distance: intersection.distance,
        point: worldPoint,
        normal: worldNormal
    };
}
