import { EntitySystem } from '../entities/system.js';
import { Entity, Solid } from '../entities/entity.js';
import { Bounds3 } from '@quake2ts/shared';

export interface TriggerVolume {
  id: number;
  classname: string;
  targetname: string | null;
  target: string | null;
  bounds: Bounds3;
  delay: number;
  message: string | null;
  sounds: number | null;
}

/**
 * Returns all activation chains starting from the given entity.
 * Each chain is an array of entity IDs, starting with the source entity.
 * Cycles are detected and terminated to prevent infinite loops.
 */
export function getActivationChain(system: EntitySystem, entityId: number): number[][] {
  const chains: number[][] = [];
  const startEntity = system.getByIndex(entityId);

  if (!startEntity || !startEntity.inUse) {
    return [];
  }

  // Helper for DFS
  function traverse(currentId: number, currentChain: number[]) {
    // Check for cycles
    if (currentChain.includes(currentId)) {
        chains.push([...currentChain, currentId]); // Append cycle closure
        return;
    }

    const newChain = [...currentChain, currentId];
    const entity = system.getByIndex(currentId);

    if (!entity || !entity.inUse) {
        chains.push(newChain);
        return;
    }

    // Find targets
    let targets: number[] = [];

    // Normal target
    if (entity.target) {
        const matches = system.findByTargetName(entity.target);
        matches.forEach(m => targets.push(m.index));
    }
    // Killtarget
    if (entity.killtarget) {
        const matches = system.findByTargetName(entity.killtarget);
        matches.forEach(m => targets.push(m.index));
    }

    if (targets.length === 0) {
        chains.push(newChain);
    } else {
        // Sort to ensure deterministic output?
        targets.sort((a, b) => a - b);
        for (const targetId of targets) {
            traverse(targetId, newChain);
        }
    }
  }

  traverse(entityId, []);
  return chains;
}

export function getTriggerVolumes(system: EntitySystem): TriggerVolume[] {
  const volumes: TriggerVolume[] = [];

  system.forEachEntity((entity) => {
    if (!entity.inUse) return;

    // Check if it's a trigger
    // Criteria: Classname starts with 'trigger_' OR solid is Solid.Trigger
    if (entity.classname.startsWith('trigger_') || entity.solid === Solid.Trigger) {
        volumes.push({
            id: entity.index,
            classname: entity.classname,
            targetname: entity.targetname || null,
            target: entity.target || null,
            bounds: {
                mins: { x: entity.absmin.x, y: entity.absmin.y, z: entity.absmin.z },
                maxs: { x: entity.absmax.x, y: entity.absmax.y, z: entity.absmax.z }
            },
            delay: entity.delay,
            message: entity.message || null,
            sounds: entity.sounds
        });
    }
  });

  return volumes;
}
