import {
  angleMod,
  lengthVec3,
  subtractVec3,
  vectorToYaw,
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
    // Don't overwrite if already set by foundTarget logic (via trail_time check)
    // Actually, huntTarget logic in original:
    // self->monsterinfo.attack_finished = level.time + 1_sec;
    // But it is called by FoundTarget... wait.

    // In `FoundTarget` (C++):
    // if (!self->monsterinfo.trail_time) ... set attack_finished
    // add skill delay ...
    // HuntTarget(self);

    // In `HuntTarget` (C++):
    // self->goalentity = self->enemy;
    // ... run/stand ...

    // `HuntTarget` does NOT set `attack_finished`.
    // It seems the TS implementation added `self.attack_finished_time = level.timeSeconds + 1;` incorrectly?
    // Or maybe it was a default?

    // If I remove it, I rely on `foundTarget` setting it.
    // What if `huntTarget` is called from elsewhere?
    // `AI_GetSightClient` -> `FoundTarget` -> `HuntTarget`
    // `ai_stand` -> `HuntTarget` (rare bug fix case)
    // `monster_use` -> `FoundTarget` -> `HuntTarget`

    // If `HuntTarget` is called directly, `attack_finished` might not be set.
    // But `FoundTarget` seems to be the main entry.

    // I will remove the line `self.attack_finished_time = level.timeSeconds + 1;` from `huntTarget`.
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

  // The C++ logic checks !trail_time to apply the initial delay.
  // In TS we use trail_time === 0 to detect "first sight" (or reset).
  if (!self.monsterinfo.trail_time) {
      self.attack_finished_time = level.timeSeconds + 0.6;
  }

  // Reaction time scaling (Always added in C++)
  if (context.skill === 0) {
      self.attack_finished_time += 0.4;
  } else if (context.skill === 1) {
      self.attack_finished_time += 0.2;
  }

  if (false) {
      // Logic for subsequent sighting or if trail_time is already set?
      // In original C++ FoundTarget:
      // if (!self->monsterinfo.trail_time) self->monsterinfo.attack_finished = level.time + 600_ms;
      // self->monsterinfo.attack_finished += skill->integer == 0 ? 400_ms : skill->integer == 1 ? 200_ms : 0_ms;

      // Wait, the logic is:
      // 1. If trail_time is 0 (first sight), set base to time + 600ms.
      // 2. ALWAYS add the skill delay.

      // My implementation was inside the `if (self.trail_time === 0)` block.
      // But the C++ code adds the delay OUTSIDE that block?

      // Let's check `rerelease/g_ai.cpp`:
      // if (!self->monsterinfo.trail_time)
      //     self->monsterinfo.attack_finished = level.time + 600_ms;
      //
      // // give easy/medium a little more reaction time
      // self->monsterinfo.attack_finished += skill->integer == 0 ? 400_ms : skill->integer == 1 ? 200_ms : 0_ms;

      // So if trail_time was NOT 0, attack_finished was NOT reset to time + 0.6.
      // But the delay is added to whatever attack_finished IS.
      // However, if attack_finished was already set from previous think, adding more delay might be cumulative?
      // No, `FoundTarget` is called when target is found.

      // If trail_time is not 0, it means we've seen them before.
      // But `FoundTarget` is called when we spot them again?
      // In `ai_stand` -> `FindTarget` -> `FoundTarget`.

      // If `trail_time` is !0, `attack_finished` might be old value?

      // But `huntTarget` (called later) sets `attack_finished_time = level.timeSeconds + 1` in `ai/targeting.ts`.
      // `huntTarget` in TS:
      //   self.monsterinfo.run?.(self, context);
      //   self.attack_finished_time = level.timeSeconds + 1;

      // This overwrites whatever we did in `foundTarget`.

      // I should modify `huntTarget` to NOT overwrite if already set, or move logic to `huntTarget`.
      // Or simply remove the hardcoded +1 in `huntTarget`.
  }

  const lastSighting = self.monsterinfo.last_sighting as { x: number; y: number; z: number };
  lastSighting.x = self.enemy.origin.x;
  lastSighting.y = self.enemy.origin.y;
  lastSighting.z = self.enemy.origin.z;
  self.trail_time = level.timeSeconds;
  self.monsterinfo.trail_time = level.timeSeconds;

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
  if (!candidate || !candidate.inUse) return false;
  if (candidate === self.enemy) return true;
  if (rejectNotargetEntity(candidate)) return false;

  if (!heardit) {
    if (!classifyClientVisibility(self, candidate, level, trace)) return false;
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
