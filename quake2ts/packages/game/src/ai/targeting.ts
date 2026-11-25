import {
  angleMod,
  lengthVec3,
  subtractVec3,
  vectorToYaw,
  addVec3,
  scaleVec3,
  type Vec3,
} from '@quake2ts/shared';
import {
  AIFlags,
  FL_NOTARGET,
  SPAWNFLAG_MONSTER_AMBUSH,
} from './constants.js';
import { RangeCategory, classifyRange, infront, rangeTo, visible, type TraceFunction } from './perception.js';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { AI_GetSightClient as GetSightClient, FindTarget, FoundTarget, HuntTarget, ai_checkattack as checkAttack } from './g_ai.js';
import { ServerFlags } from '../entities/entity.js';
import { M_CheckAttack } from './monster.js';

export { rangeTo as range, RangeCategory as Range } from './perception.js';

export interface TargetAwarenessState {
  timeSeconds: number;
  frameNumber: number;
  sightEntity: Entity | null;
  sightEntityFrame: number;
  soundEntity: Entity | null;
  soundEntityFrame: number;
  sound2Entity: Entity | null;
  sound2EntityFrame: number;
  sightClient: Entity | null;
}

export interface HearabilityHooks {
  canHear?: (self: Entity, other: Entity) => boolean;
  areasConnected?: (self: Entity, other: Entity) => boolean;
}

function setIdealYawTowards(self: Entity, other: Entity): void {
  const delta: Vec3 = {
    x: other.origin.x - self.origin.x,
    y: other.origin.y - self.origin.y,
    z: other.origin.z - self.origin.z,
  };
  self.ideal_yaw = vectorToYaw(delta);
}

// The rerelease g_ai.cpp target finding lives in g_ai.ts. These keep the older signatures that
// callers and tests use; the level awareness state and trace arguments are no longer needed,
// because the rerelease keeps sight and sound per player (client.sight_entity, sound_entity).

export function huntTarget(self: Entity, _level: TargetAwarenessState, context: EntitySystem): void {
  if (!self.enemy) return;
  HuntTarget(self, context);
}

export interface FoundTargetOptions {
  pickTarget?: (name: string) => Entity | null;
}

export function foundTarget(
  self: Entity,
  _level: TargetAwarenessState,
  context: EntitySystem,
  _options?: FoundTargetOptions,
): void {
  FoundTarget(self, context);
}

export function AI_GetSightClient(self: Entity, context: EntitySystem, _trace?: TraceFunction): Entity | null {
  return GetSightClient(self, context);
}

export function findTarget(
  self: Entity,
  _level: TargetAwarenessState,
  context: EntitySystem,
  _trace?: TraceFunction,
  _hearability: HearabilityHooks = {},
): boolean {
  return FindTarget(self, context);
}

export function ai_checkattack(self: Entity, dist: number, context: EntitySystem): boolean {
  return checkAttack(self, dist, context);
}

export function findCover(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy) return false;

    const spots = context.findByClassname('point_combat');
    for (const spot of spots) {
        if (spot.owner) continue; // Occupied
        if (spot.targetname) continue; // Triggered only

        // Check if spot is visible from self (reachable-ish)
        // Using context.trace which is available in EntitySystem
        if (!visible(self, spot, context.trace, { throughGlass: false, timeSeconds: context.timeSeconds, random: () => context.rng.frandom() })) continue;

        // Check if spot is hidden from enemy
        if (visible(spot, self.enemy, context.trace, { throughGlass: false, timeSeconds: context.timeSeconds, random: () => context.rng.frandom() })) continue;

        self.goalentity = spot;
        self.movetarget = spot;
        // Face it
        setIdealYawTowards(self, spot);

        // Run
        self.monsterinfo.run?.(self, context);
        return true;
    }
    return false;
}
