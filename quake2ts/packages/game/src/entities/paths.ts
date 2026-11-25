/**
 * path_corner and point_combat (rerelease g_misc.cpp). Both are triggers a monster touches when
 * it reaches them (G_TouchTriggers from M_MoveStep), which is what sends a patrolling monster on
 * to the next corner and holds a monster at a combat point.
 */
import type { SpawnRegistry } from './spawn.js';
import { Entity, ServerFlags, Solid } from './entity.js';
import { EntityFlags } from './enums.js';
import type { EntitySystem } from './system.js';
import { G_PickTarget } from './utils.js';
import { AIFlags } from '../ai/constants.js';
import { vectoyaw } from '../ai/m_move.js';

export const SPAWNFLAG_PATH_CORNER_TELEPORT = 1;
export const SPAWNFLAG_POINT_COMBAT_HOLD = 1;
const HOLD_FOREVER = Number.MAX_SAFE_INTEGER;

function useTargetsVia(self: Entity, target: string | undefined, activator: Entity, sys: EntitySystem): void {
  const saved = self.target;
  self.target = target;
  sys.useTargets(self, activator);
  self.target = saved;
}

/** path_corner_touch */
export function path_corner_touch(self: Entity, other: Entity | null, sys: EntitySystem): void {
  if (!other || other.movetarget !== self) return;
  if (other.enemy) return;

  if (self.pathtarget) useTargetsVia(self, self.pathtarget, other, sys);

  // see m_move; this is just so we don't needlessly check it
  self.flags |= EntityFlags.PartialGround;

  let next = self.target ? G_PickTarget(self.target, sys) : null;

  // [Paril-KEX] don't teleport to a point_combat, it means HOLD for them.
  if (next && next.classname === 'path_corner' && next.spawnflags & SPAWNFLAG_PATH_CORNER_TELEPORT) {
    other.origin = { x: next.origin.x, y: next.origin.y, z: next.origin.z + next.mins.z - other.mins.z };
    next = G_PickTarget(next.target, sys);
  }

  other.goalentity = other.movetarget = next;

  if (self.wait) {
    other.monsterinfo.pausetime = sys.timeSeconds + self.wait;
    other.monsterinfo.stand?.(other, sys);
    return;
  }

  if (!other.movetarget) {
    other.monsterinfo.pausetime = HOLD_FOREVER;
    other.monsterinfo.stand?.(other, sys);
  } else {
    const g = other.goalentity!.origin;
    other.ideal_yaw = vectoyaw({ x: g.x - other.origin.x, y: g.y - other.origin.y, z: g.z - other.origin.z });
  }
}

/** point_combat_touch */
export function point_combat_touch(self: Entity, other: Entity | null, sys: EntitySystem): void {
  if (!other || other.movetarget !== self) return;

  if (self.target) {
    other.target = self.target;
    other.goalentity = other.movetarget = G_PickTarget(other.target, sys);
    if (!other.goalentity) {
      other.movetarget = self;
    }
  } else if (self.spawnflags & SPAWNFLAG_POINT_COMBAT_HOLD && !(other.flags & (EntityFlags.Swim | EntityFlags.Fly))) {
    // already standing
    if (other.monsterinfo.aiflags & AIFlags.StandGround) return;
    other.monsterinfo.pausetime = HOLD_FOREVER;
    other.monsterinfo.aiflags |= AIFlags.StandGround | AIFlags.ThirdEye;
    other.monsterinfo.reached_hold_combat = true;
    other.monsterinfo.stand?.(other, sys);
  }

  if (other.movetarget === self) {
    // [Paril-KEX] a holding monster keeps its movetarget, to check it hasn't moved too far from
    // where it guards.
    if (!(self.spawnflags & SPAWNFLAG_POINT_COMBAT_HOLD)) {
      other.target = undefined;
      other.movetarget = null;
    }
    other.goalentity = other.enemy;
    other.monsterinfo.aiflags &= ~AIFlags.CombatPoint;
  }

  if (self.pathtarget) {
    let activator: Entity;
    if (other.enemy?.client) activator = other.enemy;
    else if (other.oldenemy?.client) activator = other.oldenemy;
    else if (other.activator?.client) activator = other.activator;
    else activator = other;
    useTargetsVia(self, self.pathtarget, activator, sys);
  }
}

export function registerPathSpawns(registry: SpawnRegistry) {
  registry.register('path_corner', (entity, context) => {
    if (!entity.targetname) {
      context.warn(`path_corner with no targetname`);
      context.free(entity);
      return;
    }
    const sys = context.entities;
    entity.solid = Solid.Trigger;
    entity.touch = (self, other) => path_corner_touch(self, other, sys);
    entity.mins = { x: -8, y: -8, z: -8 };
    entity.maxs = { x: 8, y: 8, z: 8 };
    entity.svflags |= ServerFlags.NoClient;
    sys.linkentity(entity);
  });

  registry.register('point_combat', (entity, context) => {
    const sys = context.entities;
    if (sys.deathmatch) {
      context.free(entity);
      return;
    }
    entity.solid = Solid.Trigger;
    entity.touch = (self, other) => point_combat_touch(self, other, sys);
    entity.mins = { x: -8, y: -8, z: -16 };
    entity.maxs = { x: 8, y: 8, z: 16 };
    entity.svflags = ServerFlags.NoClient;
    sys.linkentity(entity);
  });
}
