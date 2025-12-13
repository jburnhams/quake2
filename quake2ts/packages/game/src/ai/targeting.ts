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

function faceYawInstantly(self: Entity): void {
  (self.angles as { y: number }).y = angleMod(self.ideal_yaw);
}

export function huntTarget(self: Entity, level: TargetAwarenessState, context: EntitySystem): void {
  if (!self.enemy) return;

  self.goalentity = self.enemy;
  setIdealYawTowards(self, self.enemy);
  faceYawInstantly(self);
  if ((self.monsterinfo.aiflags & AIFlags.StandGround) !== 0) {
    self.monsterinfo.stand?.(self, context);
  } else {
    self.monsterinfo.run?.(self, context);
  }
}

export interface FoundTargetOptions {
  pickTarget?: (name: string) => Entity | null;
}

export function foundTarget(
  self: Entity,
  level: TargetAwarenessState,
  context: EntitySystem,
  options?: FoundTargetOptions,
): void {
  if (!self.enemy) return;

  if ((self.enemy.svflags & ServerFlags.Player) !== 0) {
    level.sightEntity = self;
    level.sightEntityFrame = level.frameNumber;
    self.light_level = 128;
  }

  self.show_hostile = level.timeSeconds + 1;

  // Reaction time delay
  if (!self.monsterinfo.trail_time) {
      self.attack_finished_time = level.timeSeconds + 0.6;
  }

  if (context.skill === 0) {
      self.attack_finished_time += 0.4;
  } else if (context.skill === 1) {
      self.attack_finished_time += 0.2;
  }

  // Update last sighting and blind fire target
  const lastSighting = self.monsterinfo.last_sighting as { x: number; y: number; z: number };
  lastSighting.x = self.enemy.origin.x;
  lastSighting.y = self.enemy.origin.y;
  lastSighting.z = self.enemy.origin.z;
  self.trail_time = level.timeSeconds;
  self.monsterinfo.trail_time = level.timeSeconds;

  // Update blind fire target: self->monsterinfo.blind_fire_target = self->monsterinfo.last_sighting + (self->enemy->velocity * -0.1f);
  self.monsterinfo.blind_fire_target = addVec3(lastSighting, scaleVec3(self.enemy.velocity, -0.1));
  self.monsterinfo.blind_fire_delay = 0;

  // Clear third eye
  // self.monsterinfo.aiflags &= ~AIFlags.ThirdEye; // Need to define ThirdEye if used

  if (!self.combattarget) {
    huntTarget(self, level, context);
    return;
  }

  const pickTarget = options?.pickTarget;
  const movetarget = pickTarget?.(self.combattarget) ?? self.enemy;
  self.goalentity = movetarget;
  self.movetarget = movetarget;
  self.combattarget = undefined;
  self.monsterinfo.aiflags |= AIFlags.CombatPoint;
  if (self.movetarget) {
    self.movetarget.targetname = undefined;
  }
  self.monsterinfo.pausetime = 0;
  self.monsterinfo.run?.(self, context);
}

function classifyClientVisibility(
  self: Entity,
  other: Entity,
  level: TargetAwarenessState,
  trace: TraceFunction,
): boolean {
  const distance = rangeTo(self, other);
  const range = classifyRange(distance);

  if (range === RangeCategory.Far) return false;
  if (other.light_level <= 5) return false;
  if (!visible(self, other, trace, { throughGlass: false })) return false;

  if (range === RangeCategory.Near) {
    return level.timeSeconds <= other.show_hostile || infront(self, other);
  }

  if (range === RangeCategory.Mid) {
    return infront(self, other);
  }

  return true;
}

export function AI_GetSightClient(
  self: Entity,
  context: EntitySystem,
  trace: TraceFunction,
): Entity | null {
  if ((self.monsterinfo.aiflags & AIFlags.NoStep) !== 0) {
    return null;
  }

  for (let i = 1; i <= context.maxClients; i++) {
    const ent = context.entities[i];
    if (!ent || !ent.inUse || ent.health <= 0) {
      continue;
    }
    if ((ent.flags & FL_NOTARGET) !== 0) {
      continue;
    }
    if (visible(self, ent, trace, { throughGlass: false })) {
      return ent;
    }
  }

  return null;
}

function updateSoundChase(
  self: Entity,
  client: Entity,
  level: TargetAwarenessState,
  hearability: HearabilityHooks,
  trace: TraceFunction,
): boolean {
  if ((self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) !== 0) {
    if (!visible(self, client, trace)) return false;
  } else if (hearability.canHear && !hearability.canHear(self, client)) {
    return false;
  }

  const delta = subtractVec3(client.origin, self.origin);
  if (lengthVec3(delta) > 1000) return false;
  if (hearability.areasConnected && !hearability.areasConnected(self, client)) return false;

  self.ideal_yaw = vectorToYaw(delta);
  faceYawInstantly(self);
  self.monsterinfo.aiflags |= AIFlags.SoundTarget;
  self.enemy = client;
  return true;
}

function chooseCandidate(self: Entity, level: TargetAwarenessState): { candidate: Entity | null; heardit: boolean } {
  if (
    level.sightEntity &&
    level.sightEntityFrame >= level.frameNumber - 1 &&
    (self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) === 0
  ) {
    if (level.sightEntity.enemy !== self.enemy) {
      return { candidate: level.sightEntity, heardit: false };
    }
    return { candidate: null, heardit: false };
  }

  if (level.soundEntity && level.soundEntityFrame >= level.frameNumber - 1) {
    return { candidate: level.soundEntity, heardit: true };
  }

  if (
    !self.enemy &&
    level.sound2Entity &&
    level.sound2EntityFrame >= level.frameNumber - 1 &&
    (self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) === 0
  ) {
    return { candidate: level.sound2Entity, heardit: true };
  }

  if (level.sightClient) {
    return { candidate: level.sightClient, heardit: false };
  }

  return { candidate: null, heardit: false };
}

function rejectNotargetEntity(client: Entity): boolean {
  if ((client.flags & FL_NOTARGET) !== 0) return true;
  if ((client.svflags & ServerFlags.Monster) !== 0 && client.enemy) {
    return (client.enemy.flags & FL_NOTARGET) !== 0;
  }
  if (client.enemy && (client.enemy.flags & FL_NOTARGET) !== 0) return true;
  return false;
}

export function findTarget(
  self: Entity,
  level: TargetAwarenessState,
  context: EntitySystem,
  trace: TraceFunction,
  hearability: HearabilityHooks = {},
): boolean {
  if ((self.monsterinfo.aiflags & AIFlags.GoodGuy) !== 0) {
    if (self.goalentity?.classname === 'target_actor') {
      return false;
    }
    return false;
  }

  if ((self.monsterinfo.aiflags & AIFlags.CombatPoint) !== 0) {
    return false;
  }

  const { candidate, heardit } = chooseCandidate(self, level);
  if (!candidate || !candidate.inUse) {
    return false;
  }
  if (candidate === self.enemy) {
    return true;
  }
  if (rejectNotargetEntity(candidate)) {
    return false;
  }

  if (!heardit) {
    if (!classifyClientVisibility(self, candidate, level, trace)) {
        return false;
    }
    self.monsterinfo.aiflags &= ~AIFlags.SoundTarget;
    self.enemy = candidate;
  } else if (!updateSoundChase(self, candidate, level, hearability, trace)) {
    return false;
  }

  foundTarget(self, level, context);
  if ((self.monsterinfo.aiflags & AIFlags.SoundTarget) === 0) {
    self.monsterinfo.sight?.(self, self.enemy!);
  }

  return true;
}

// Reference: g_ai.c lines 152-350
// Updated to include this file in the patch and confirm export
export function ai_checkattack(self: Entity, dist: number, context: EntitySystem): boolean {
  // this is the main combat logic loop

  if (!self.enemy) {
    return false;
  }

  // if the enemy is dead, find a new target
  // (Assuming check_target_dead or similar logic is handled elsewhere or inline here if needed)
  // In Quake 2, CheckAttack is called.

  const checkAttack = self.monsterinfo.checkattack || M_CheckAttack;
  return checkAttack(self, context);
}
