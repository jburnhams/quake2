import { Entity } from '../entities/entity';
import { EntitySystem } from '../entities/system';
import { BoundingBox } from '@quake2ts/shared';
import { vec3 } from 'gl-matrix';

export interface EntityMetadata {
  id: number;
  classname: string;
  origin: vec3;
  angles: vec3;
  model: string | null;
  targetname: string | null;
  target: string | null;
  spawnflags: number;
  health: number;
  inuse: boolean;
}

export interface EntityConnection {
  targetId: number;
  targetName: string;
  type: 'target' | 'killtarget' | 'other';
}

export interface ModelReference {
  modelName: string;
  modelIndex: number;
}

export function getEntityMetadata(entity: Entity): EntityMetadata {
  return {
    id: entity.s.number,
    classname: entity.classname,
    origin: vec3.clone(entity.s.origin),
    angles: vec3.clone(entity.s.angles),
    model: entity.model || null,
    targetname: entity.targetname || null,
    target: entity.target || null,
    spawnflags: entity.spawnflags,
    health: entity.health,
    inuse: entity.inuse
  };
}

export function getEntityFields(entity: Entity): Record<string, any> {
  const fields: Record<string, any> = {};

  // Iterate over all properties of the entity
  for (const key in entity) {
    if (Object.prototype.hasOwnProperty.call(entity, key)) {
       const value = (entity as any)[key];
       // Filter out functions and internal/circular references if needed
       if (typeof value !== 'function' && key !== 's') {
         // Note: 's' is the network state, usually we can include it or parts of it
         fields[key] = value;
       }
    }
  }
  return fields;
}

export function getEntityConnections(entity: Entity, system: EntitySystem): EntityConnection[] {
  const connections: EntityConnection[] = [];

  if (entity.target) {
    // Find entities with matching targetname
    system.forEachEntity((other) => {
      if (other.targetname === entity.target) {
        connections.push({
          targetId: other.s.number,
          targetName: other.classname,
          type: 'target'
        });
      }
    });
  }

  // Could add other connection types here (killtarget, etc.)

  return connections;
}

export function getEntityBounds(entity: Entity): BoundingBox {
  return {
    mins: vec3.clone(entity.absmin),
    maxs: vec3.clone(entity.absmax)
  };
}

export function getEntityModel(entity: Entity): ModelReference | null {
  if (entity.model) {
    return {
      modelName: entity.model,
      modelIndex: entity.s.modelindex
    };
  }
  return null;
}
