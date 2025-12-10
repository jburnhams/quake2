import { EntitySystem } from '../entities/system.js';
import { vec3 } from 'gl-matrix';

export function findEntitiesByClassname(system: EntitySystem, classname: string): number[] {
  const ids: number[] = [];
  system.forEachEntity((entity: any) => {
    if (entity.classname === classname) {
      ids.push(entity.index);
    }
  });
  return ids;
}

export function findEntitiesByTargetname(system: EntitySystem, targetname: string): number[] {
  const ids: number[] = [];
  system.forEachEntity((entity: any) => {
    if (entity.targetname === targetname) {
      ids.push(entity.index);
    }
  });
  return ids;
}

export function findEntitiesInRadius(system: EntitySystem, origin: vec3, radius: number): number[] {
  const ids: number[] = [];
  const r2 = radius * radius;

  system.forEachEntity((entity: any) => {
    if (!entity.inUse) return;

    // Check distance squared using Vec3 properties
    const dx = entity.origin.x - origin[0];
    const dy = entity.origin.y - origin[1];
    const dz = entity.origin.z - origin[2];
    const d2 = dx*dx + dy*dy + dz*dz;

    if (d2 <= r2) {
      ids.push(entity.index);
    }
  });
  return ids;
}

export function findEntitiesInBounds(system: EntitySystem, mins: vec3, maxs: vec3): number[] {
  const ids: number[] = [];
  system.forEachEntity((entity: any) => {
    if (!entity.inUse) return;

    const eMins = entity.absmin;
    const eMaxs = entity.absmax;

    // Check overlap using Vec3 properties
    if (eMins.x > maxs[0] || eMaxs.x < mins[0]) return;
    if (eMins.y > maxs[1] || eMaxs.y < mins[1]) return;
    if (eMins.z > maxs[2] || eMaxs.z < mins[2]) return;

    ids.push(entity.index);
  });
  return ids;
}

export function searchEntityFields(system: EntitySystem, field: string, value: any): number[] {
  const ids: number[] = [];
  system.forEachEntity((entity: any) => {
    if ((entity as any)[field] === value) {
      ids.push(entity.index);
    }
  });
  return ids;
}

export function getAllEntityClassnames(system: EntitySystem): string[] {
  const names = new Set<string>();
  system.forEachEntity((entity: any) => {
    if (entity.classname) {
      names.add(entity.classname);
    }
  });
  return Array.from(names).sort();
}
