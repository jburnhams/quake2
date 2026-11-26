import {
  Vec3,
  dotVec3,
  subtractVec3,
  addVec3,
  scaleVec3,
  normalizeVec3,
  angleVectors
} from '@quake2ts/shared';
import { Entity } from './entity.js';
import { EntitySystem } from './system.js';

export interface EntityHit {
  entity: Entity;
  fraction: number;
  point: Vec3;
  normal: Vec3;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface EntityMetadata {
  id: number;
  classname: string;
  origin: Vec3;
  angles: Vec3;
  model?: string;
  targetname?: string;
  target?: string;
  killtarget?: string;
  spawnflags: number;
  [key: string]: any;
}

export interface EntityConnection {
  sourceId: number;
  targetId: number;
  type: 'target' | 'killtarget' | 'other';
}

export interface EntityGraph {
  nodes: { id: number; label: string; type: string }[];
  edges: { source: number; target: number; label: string }[];
}

export interface CameraLike {
    origin: Vec3;
    axis: [Vec3, Vec3, Vec3]; // Forward, Left, Up
    fovX: number;
    fovY: number;
    width: number;
    height: number;
}

export class EntitySelection {
  constructor(private system: EntitySystem) {}

  rayCastEntities(origin: Vec3, direction: Vec3): EntityHit[] {
    const hits: EntityHit[] = [];
    const dir = normalizeVec3(direction);

    // Ray length - reasonably large
    const maxDist = 8192;
    const end = addVec3(origin, scaleVec3(dir, maxDist));

    this.system.forEachEntity((entity) => {
      // 1. BSP Brush Model (e.g. func_wall, func_door)
      if (entity.model && entity.model.startsWith('*')) {
        // Use traceModel if available
        if (this.system.imports.traceModel) {
            const tr = this.system.imports.traceModel(entity, origin, end);
            if (tr.fraction < 1.0) {
                hits.push({
                    entity,
                    fraction: tr.fraction,
                    point: tr.endpos,
                    normal: tr.plane ? tr.plane.normal : {x:0,y:0,z:0} // Fallback
                });
            }
        }
        return;
      }

      // 2. Standard Entities (AABB / OBB)
      // Check if entity has mins/maxs
      if (!entity.mins || !entity.maxs) return;

      // Filter out non-solid or tiny entities if desired?
      // Requirement says "all entity types".

      let hit: EntityHit | null = null;

      // Optimization: Simple AABB test first (using absmin/absmax if available, or computing it)
      // This culls entities far away.
      if (entity.absmin && entity.absmax) {
          if (!rayAabbIntersect(origin, dir, entity.absmin, entity.absmax, maxDist)) {
              return;
          }
      }

      // Detailed Intersection
      const hasRotation = entity.angles && (entity.angles.x !== 0 || entity.angles.y !== 0 || entity.angles.z !== 0);

      if (hasRotation) {
          hit = this.intersectObb(entity, origin, dir, maxDist);
      } else {
          // AABB intersection in world space (offset by origin)
          const absMins = addVec3(entity.origin, entity.mins);
          const absMaxs = addVec3(entity.origin, entity.maxs);
          hit = this.intersectAabb(entity, origin, dir, absMins, absMaxs, maxDist);
      }

      if (hit) {
          hits.push(hit);
      }
    });

    // Sort by distance (fraction)
    hits.sort((a, b) => a.fraction - b.fraction);
    return hits;
  }

  private intersectAabb(entity: Entity, origin: Vec3, dir: Vec3, mins: Vec3, maxs: Vec3, maxDist: number): EntityHit | null {
      // Slab method
      let tMin = 0.0;
      let tMax = maxDist;
      let normal = { x: 0, y: 0, z: 0 };

      // X axis
      if (Math.abs(dir.x) < 1e-6) {
          if (origin.x < mins.x || origin.x > maxs.x) return null;
      } else {
          const invD = 1.0 / dir.x;
          let t1 = (mins.x - origin.x) * invD;
          let t2 = (maxs.x - origin.x) * invD;
          let n = { x: -1, y: 0, z: 0 };
          if (t1 > t2) {
              const temp = t1; t1 = t2; t2 = temp;
              n = { x: 1, y: 0, z: 0 };
          }
          if (t1 > tMin) {
              tMin = t1;
              normal = n;
          }
          if (t2 < tMax) tMax = t2;
          if (tMin > tMax) return null;
      }

      // Y axis
      if (Math.abs(dir.y) < 1e-6) {
          if (origin.y < mins.y || origin.y > maxs.y) return null;
      } else {
          const invD = 1.0 / dir.y;
          let t1 = (mins.y - origin.y) * invD;
          let t2 = (maxs.y - origin.y) * invD;
          let n = { x: 0, y: -1, z: 0 };
          if (t1 > t2) {
              const temp = t1; t1 = t2; t2 = temp;
              n = { x: 0, y: 1, z: 0 };
          }
          if (t1 > tMin) {
              tMin = t1;
              normal = n;
          }
          if (t2 < tMax) tMax = t2;
          if (tMin > tMax) return null;
      }

      // Z axis
      if (Math.abs(dir.z) < 1e-6) {
          if (origin.z < mins.z || origin.z > maxs.z) return null;
      } else {
          const invD = 1.0 / dir.z;
          let t1 = (mins.z - origin.z) * invD;
          let t2 = (maxs.z - origin.z) * invD;
          let n = { x: 0, y: 0, z: -1 };
          if (t1 > t2) {
              const temp = t1; t1 = t2; t2 = temp;
              n = { x: 0, y: 0, z: 1 };
          }
          if (t1 > tMin) {
              tMin = t1;
              normal = n;
          }
          if (t2 < tMax) tMax = t2;
          if (tMin > tMax) return null;
      }

      const point = addVec3(origin, scaleVec3(dir, tMin));
      return {
          entity,
          fraction: tMin / maxDist,
          point,
          normal
      };
  }

  private intersectObb(entity: Entity, origin: Vec3, dir: Vec3, maxDist: number): EntityHit | null {
      // Get basis vectors for the entity's rotation
      const vectors = angleVectors(entity.angles);
      const forward = vectors.forward;
      const right = vectors.right;
      const up = vectors.up;

      // Quake 2 Coordinate System:
      // X = Forward
      // Y = Left (usually)
      // Z = Up
      // angleVectors returns 'right' which is usually pointing to the right (negative Y in standard Quake).
      // So Left = -Right.
      // Basis:
      // X-axis: forward
      // Y-axis: -right (Left)
      // Z-axis: up

      const left = scaleVec3(right, -1);

      // Transform Ray Start and Direction to Local Space
      // 1. Translation: relative to entity origin
      const relOrigin = subtractVec3(origin, entity.origin);

      // 2. Rotation (Inverse of Entity Rotation)
      // Since rotation matrix is orthogonal, Inverse = Transpose.
      // Local.x = dot(World, AxisX)
      // Local.y = dot(World, AxisY)
      // Local.z = dot(World, AxisZ)

      const localOrigin = {
          x: dotVec3(relOrigin, forward),
          y: dotVec3(relOrigin, left),
          z: dotVec3(relOrigin, up)
      };

      const localDir = {
          x: dotVec3(dir, forward),
          y: dotVec3(dir, left),
          z: dotVec3(dir, up)
      };

      // Perform AABB intersection in local space
      // Note: In local space, the entity is axis-aligned at (0,0,0) + mins/maxs
      // We pass {0,0,0} as "origin" for AABB check because we already shifted the ray origin.
      // But intersectAabb expects absolute mins/maxs relative to the passed origin?
      // No, intersectAabb logic:
      // t1 = (mins.x - origin.x) * invD
      // Here, "origin" is the ray start. "mins" are the box bounds.
      // So we pass localOrigin as origin, and entity.mins/maxs as bounds.

      // We re-use intersectAabb logic but we can't call it directly because it computes
      // the hit point and normal in the space it's given (local space here).
      // We need to transform them back.

      // Let's implement slab method inline or call a helper that returns local T and Normal.
      // Re-using intersectAabb by passing local coords:
      // It returns point/normal in local space.
      // We need to transform them back to world.

      // Wait, intersectAabb expects "mins" and "maxs" to be ABSOLUTE world coordinates usually
      // in the usage above: addVec3(entity.origin, entity.mins).
      // Here in local space, the box is simply at mins...maxs.
      // So we pass entity.mins and entity.maxs directly.

      // However, intersectAabb returns `point` = origin + dir * t.
      // This will be in local space.
      // `normal` will be in local space.

      const hitLocal = this.intersectAabb(entity, localOrigin, localDir, entity.mins, entity.maxs, maxDist);

      if (!hitLocal) return null;

      // Transform normal back to world space
      // WorldNormal = LocalNormal.x * AxisX + LocalNormal.y * AxisY + LocalNormal.z * AxisZ
      const nx = scaleVec3(forward, hitLocal.normal.x);
      const ny = scaleVec3(left, hitLocal.normal.y);
      const nz = scaleVec3(up, hitLocal.normal.z);
      const worldNormal = addVec3(addVec3(nx, ny), nz);

      // Calculate world point using the fraction (t) which is invariant under rotation/translation (if dir length is preserved)
      // But we passed 'localDir'. Did we normalize it?
      // 'dir' was normalized. Rotation preserves length. So 'localDir' is normalized.
      // So fraction t is correct distance in world units.
      const worldPoint = addVec3(origin, scaleVec3(dir, hitLocal.fraction * maxDist));

      return {
          entity,
          fraction: hitLocal.fraction,
          point: worldPoint,
          normal: worldNormal
      };
  }

  // 2.1.2 Entity Metadata API
  getEntityMetadata(entityId: number): EntityMetadata | null {
      const entity = this.system.getByIndex(entityId);
      if (!entity) return null;

      return {
          id: entity.index,
          classname: entity.classname || 'unknown',
          origin: { ...entity.origin },
          angles: { ...entity.angles },
          model: entity.model,
          targetname: entity.targetname,
          target: entity.target,
          killtarget: entity.killtarget,
          spawnflags: entity.spawnflags,
          ...this.getEntityFields(entityId)
      };
  }

  getEntityFields(entityId: number): Record<string, any> {
      const entity = this.system.getByIndex(entityId);
      if (!entity) return {};
      const fields: Record<string, any> = {};
      for (const key in entity) {
          const val = (entity as any)[key];
          if (typeof val !== 'function') {
              fields[key] = val;
          }
      }
      return fields;
  }

  getEntityConnections(entityId: number): EntityConnection[] {
      const entity = this.system.getByIndex(entityId);
      if (!entity) return [];

      const connections: EntityConnection[] = [];

      if (entity.target) {
          const targets = this.system.findByTargetName(entity.target);
          targets.forEach(t => {
              connections.push({ sourceId: entity.index, targetId: t.index, type: 'target' });
          });
      }
      if (entity.killtarget) {
          const targets = this.system.findByTargetName(entity.killtarget);
          targets.forEach(t => {
              connections.push({ sourceId: entity.index, targetId: t.index, type: 'killtarget' });
          });
      }

      if (entity.targetname) {
          this.system.forEachEntity(other => {
              if (other.target === entity.targetname) {
                  connections.push({ sourceId: other.index, targetId: entity.index, type: 'target' });
              }
              if (other.killtarget === entity.targetname) {
                  connections.push({ sourceId: other.index, targetId: entity.index, type: 'killtarget' });
              }
          });
      }

      return connections;
  }

  getEntityBounds(entityId: number): { mins: Vec3, maxs: Vec3 } | null {
      const entity = this.system.getByIndex(entityId);
      if (!entity || !entity.absmin || !entity.absmax) return null;
      return {
          mins: entity.absmin,
          maxs: entity.absmax
      };
  }

  getEntityModel(entityId: number): string | null {
      const entity = this.system.getByIndex(entityId);
      if (!entity) return null;
      return entity.model || null;
  }

  // 2.1.3 Entity Filtering and Search
  findEntitiesByClassname(classname: string): number[] {
      return this.system.findByClassname(classname).map(e => e.index);
  }

  findEntitiesByTargetname(targetname: string): number[] {
      return this.system.findByTargetName(targetname).map(e => e.index);
  }

  findEntitiesInRadius(origin: Vec3, radius: number): number[] {
      return this.system.findByRadius(origin, radius).map(e => e.index);
  }

  findEntitiesInBounds(mins: Vec3, maxs: Vec3): number[] {
      return this.system.findInBox(mins, maxs).map(e => e.index);
  }

  searchEntityFields(field: string, value: any): number[] {
      const results: number[] = [];
      this.system.forEachEntity(e => {
          if ((e as any)[field] === value) {
              results.push(e.index);
          }
      });
      return results;
  }

  getAllEntityClassnames(): string[] {
      const names = new Set<string>();
      this.system.forEachEntity(e => {
          if (e.classname) names.add(e.classname);
      });
      return Array.from(names).sort();
  }

  // 2.3.1 Entity Graph
  getEntityGraph(): EntityGraph {
      const nodes: EntityGraph['nodes'] = [];
      const edges: EntityGraph['edges'] = [];

      this.system.forEachEntity(e => {
          nodes.push({
              id: e.index,
              label: e.classname || e.targetname || `Entity ${e.index}`,
              type: e.classname || 'unknown'
          });

          if (e.target) {
              const targets = this.system.findByTargetName(e.target);
              targets.forEach(t => {
                  edges.push({ source: e.index, target: t.index, label: 'target' });
              });
          }
          if (e.killtarget) {
              const targets = this.system.findByTargetName(e.killtarget);
              targets.forEach(t => {
                  edges.push({ source: e.index, target: t.index, label: 'killtarget' });
              });
          }
      });

      return { nodes, edges };
  }
}

// Utility to intersect Ray with AABB
function rayAabbIntersect(origin: Vec3, dir: Vec3, mins: Vec3, maxs: Vec3, maxDist: number): boolean {
    let tMin = 0.0;
    let tMax = maxDist;

    // X
    if (Math.abs(dir.x) < 1e-6) {
        if (origin.x < mins.x || origin.x > maxs.x) return false;
    } else {
        const invD = 1.0 / dir.x;
        let t1 = (mins.x - origin.x) * invD;
        let t2 = (maxs.x - origin.x) * invD;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    // Y
    if (Math.abs(dir.y) < 1e-6) {
        if (origin.y < mins.y || origin.y > maxs.y) return false;
    } else {
        const invD = 1.0 / dir.y;
        let t1 = (mins.y - origin.y) * invD;
        let t2 = (maxs.y - origin.y) * invD;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    // Z
    if (Math.abs(dir.z) < 1e-6) {
        if (origin.z < mins.z || origin.z > maxs.z) return false;
    } else {
        const invD = 1.0 / dir.z;
        let t1 = (mins.z - origin.z) * invD;
        let t2 = (maxs.z - origin.z) * invD;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    return true;
}
