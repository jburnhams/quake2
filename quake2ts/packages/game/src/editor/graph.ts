import { EntitySystem } from '../entities/system.js';
import { Entity } from '../entities/entity.js';

export interface GraphNode {
  id: number;
  classname: string;
  targetname: string | null;
}

export interface GraphEdge {
  from: number;
  to: number;
  type: 'target' | 'killtarget' | 'other';
}

export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function getEntityGraph(system: EntitySystem): EntityGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const targetNameMap = new Map<string, number[]>();

  // First pass: collect nodes and map targetnames
  system.forEachEntity((entity: Entity) => {
    if (!entity.inUse) return;

    nodes.push({
      id: entity.index,
      classname: entity.classname,
      targetname: entity.targetname || null
    });

    if (entity.targetname) {
      if (!targetNameMap.has(entity.targetname)) {
        targetNameMap.set(entity.targetname, []);
      }
      targetNameMap.get(entity.targetname)!.push(entity.index);
    }
  });

  // Second pass: create edges
  system.forEachEntity((entity: Entity) => {
    if (!entity.inUse) return;

    if (entity.target) {
      const targets = targetNameMap.get(entity.target);
      if (targets) {
        for (const targetId of targets) {
          edges.push({
            from: entity.index,
            to: targetId,
            type: 'target'
          });
        }
      }
    }

    if (entity.killtarget) {
      const targets = targetNameMap.get(entity.killtarget);
      if (targets) {
        for (const targetId of targets) {
          edges.push({
            from: entity.index,
            to: targetId,
            type: 'killtarget'
          });
        }
      }
    }
  });

  return { nodes, edges };
}

export function getEntityTargets(system: EntitySystem, entityId: number): number[] {
  const entity = system.getByIndex(entityId);
  if (!entity || !entity.inUse) return [];

  const targets: number[] = [];
  if (entity.target) {
     const matches = system.findByTargetName(entity.target);
     matches.forEach(m => targets.push(m.index));
  }
  return targets;
}

export function getEntitySources(system: EntitySystem, entityId: number): number[] {
  const entity = system.getByIndex(entityId);
  if (!entity || !entity.inUse || !entity.targetname) return [];

  const sources: number[] = [];
  const targetname = entity.targetname;

  system.forEachEntity((other: Entity) => {
     if (!other.inUse) return;
     if (other.target === targetname || other.killtarget === targetname) {
        sources.push(other.index);
     }
  });

  return sources;
}
