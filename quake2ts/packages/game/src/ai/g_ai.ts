/**
 * The rerelease g_ai.cpp: how a monster notices players (sight, other monsters, sounds), decides
 * to attack, and chases. Ported function by function. Left out: Rogue hint paths (no hint_path
 * entities are handled yet) and the player trail (PlayerTrail_Pick returns nothing), so a monster
 * that loses sight goes to where it last saw the player and searches from there.
 *
 * One change from the C: ai_run and ai_walk's temporary goal is a detached entity rather than a
 * G_Spawn'd one, so chasing monsters do not churn the entity pool forty times a second.
 */
import {
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  CONTENTS_WINDOW,
  MASK_OPAQUE,
  MASK_PLAYERSOLID,
  MASK_SOLID,
  CONTENTS_SOLID,
  angleVectors,
  closestPointToBox,
  dotVec3,
  normalizeVec3,
  projectSourceVec3,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, ServerFlags, Solid } from '../entities/entity.js';
import { EntityFlags } from '../entities/enums.js';
import type { EntitySystem } from '../entities/system.js';
import { G_PickTarget } from '../entities/utils.js';
import { AIFlags, AttackState, RANGE_MELEE, RANGE_MID, RANGE_NEAR, SPAWNFLAG_MONSTER_AMBUSH } from './constants.js';
import { FacingIdeal, M_ChangeYaw, M_MoveToGoal, M_walkmove, SV_CloseEnough, vectoyaw } from './m_move.js';

const MAX_SIDESTEP = 8;
const HOLD_FOREVER = Number.MAX_SAFE_INTEGER;
/** HACKFLAG_ATTACK_PLAYER (rtest) */
const HACKFLAG_ATTACK_PLAYER = 1;

// The C keeps these as globals that ai_checkattack sets and ai_run reads.
let enemy_vis = false;
let enemy_infront = false;
let enemy_yaw = 0;

/** For tests: what the last ai_checkattack found. */
export function lastCheckAttack() {
  return { enemy_vis, enemy_infront, enemy_yaw };
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const len = (a: Vec3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
const copy = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });

function boxesIntersect(amin: Vec3, amax: Vec3, bmin: Vec3, bmax: Vec3): boolean {
  return amin.x <= bmax.x && amax.x >= bmin.x && amin.y <= bmax.y && amax.y >= bmin.y && amin.z <= bmax.z && amax.z >= bmin.z;
}

/** distance_between_boxes */
function distanceBetweenBoxes(amin: Vec3, amax: Vec3, bmin: Vec3, bmax: Vec3): number {
  let d = 0;
  for (const k of ['x', 'y', 'z'] as const) {
    if (amax[k] < bmin[k]) d += (bmin[k] - amax[k]) ** 2;
    else if (amin[k] > bmax[k]) d += (amin[k] - bmax[k]) ** 2;
  }
  return Math.sqrt(d);
}

/** random_time(min, max), in seconds. */
const randomTime = (sys: EntitySystem, min: number, max: number) => min + (max - min) * sys.rng.frandom();

/** active_players(): the in-use client entities. */
function activePlayers(sys: EntitySystem): Entity[] {
  const players: Entity[] = [];
  sys.forEachEntity((e) => {
    if (e.inUse && e.client && e.svflags & ServerFlags.Player) players.push(e);
  });
  return players;
}

/** `time >= level.time - FRAME_TIME_S`, in milliseconds as the C's gtime_t is, so float sums match. */
const withinLastFrame = (time: number | undefined, sys: EntitySystem) =>
  time !== undefined && Math.round(time * 1000) >= Math.round((sys.timeSeconds - (sys.frameTimeSeconds || 0.025)) * 1000);

const isDead = (p: Entity) => p.health <= 0 || !!p.deadflag || !p.solid;

/** Sets the five fields every "I can see my enemy" path in the C sets together. */
function recordSighting(self: Entity, sys: EntitySystem): void {
  const enemy = self.enemy!;
  self.monsterinfo.last_sighting = copy(enemy.origin);
  self.monsterinfo.saved_goal = copy(enemy.origin);
  self.monsterinfo.trail_time = sys.timeSeconds;
  self.monsterinfo.blind_fire_target = add(enemy.origin, scale(enemy.velocity, -0.1));
  self.monsterinfo.blind_fire_delay = 0;
}

function clearLostSight(self: Entity, sys: EntitySystem): void {
  if (self.monsterinfo.aiflags & AIFlags.LostSight) {
    self.monsterinfo.aiflags &= ~AIFlags.LostSight;
    if ((self.monsterinfo.move_block_change_time ?? 0) < sys.timeSeconds) {
      self.monsterinfo.aiflags &= ~AIFlags.TempMeleeCombat;
    }
  }
}

/** AI_GetSightClient: a random player this monster can see in front of it. */
export function AI_GetSightClient(self: Entity, sys: EntitySystem): Entity | null {
  if ((sys.level as { intermissiontime?: number }).intermissiontime) return null;

  const visiblePlayers: Entity[] = [];
  for (const player of activePlayers(sys)) {
    if (isDead(player)) continue;
    if (player.flags & (EntityFlags.NoTarget | EntityFlags.Disguised)) continue;

    // if we're touching them, allow to pass through
    if (!boxesIntersect(self.absmin, self.absmax, player.absmin, player.absmax)) {
      if ((!(self.monsterinfo.aiflags & AIFlags.ThirdEye) && !infront(self, player)) || !visible(self, player, sys)) continue;
    }
    visiblePlayers.push(player);
  }

  if (!visiblePlayers.length) return null;
  return visiblePlayers[sys.rng.irandom(visiblePlayers.length)];
}

/** ai_move: move the distance at the current facing. */
export function ai_move(self: Entity, dist: number, sys: EntitySystem): void {
  M_walkmove(self, self.angles.y, dist, sys);
}

/** ai_stand: standing around and looking for players. */
export function ai_stand(self: Entity, dist: number, sys: EntitySystem): void {
  const mi = self.monsterinfo;
  if (dist || mi.aiflags & AIFlags.AlternateFly) M_walkmove(self, self.angles.y, dist, sys);

  if (mi.aiflags & AIFlags.StandGround) {
    // [Paril-KEX] check if we've been pushed out of our point_combat
    if (!(mi.aiflags & AIFlags.TempStandGround) && self.movetarget?.classname === 'point_combat') {
      if (!boxesIntersect(self.absmin, self.absmax, self.movetarget.absmin, self.movetarget.absmax)) {
        mi.aiflags &= ~AIFlags.StandGround;
        mi.aiflags |= AIFlags.CombatPoint;
        self.goalentity = self.movetarget;
        mi.run?.(self, sys);
        return;
      }
    }

    if (self.enemy && self.enemy.classname !== 'player_noise') {
      self.ideal_yaw = vectoyaw(sub(self.enemy.origin, self.origin));
      if (!FacingIdeal(self) && mi.aiflags & AIFlags.TempStandGround) {
        mi.aiflags &= ~(AIFlags.StandGround | AIFlags.TempStandGround);
        mi.run?.(self, sys);
      }
      if (!(mi.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);
      // find out if we're going to be shooting
      const retval = ai_checkattack(self, 0, sys);
      // record sightings of player
      if (self.enemy && self.enemy.inUse) {
        if (visible(self, self.enemy, sys)) {
          mi.aiflags &= ~AIFlags.LostSight;
          recordSighting(self, sys);
        } else {
          if (FindTarget(self, sys)) return;
          mi.aiflags |= AIFlags.LostSight;
        }
        // Paril: fixes rare cases of a stand ground monster being stuck aiming at a sound
        // target that they can still see
        if (mi.aiflags & AIFlags.SoundTarget && !retval) {
          if (FindTarget(self, sys)) return;
        }
      } else if (!retval) {
        // check retval to make sure we're not blindfiring
        FindTarget(self, sys);
        return;
      }
    } else {
      FindTarget(self, sys);
    }
    return;
  }

  // Paril: a monster given an enemy without HuntTarget being called.
  if (self.enemy && !(mi.aiflags & AIFlags.SoundTarget)) {
    HuntTarget(self, sys);
    return;
  }

  if (FindTarget(self, sys)) return;

  const now = sys.timeSeconds;
  if (now > mi.pausetime) {
    mi.walk?.(self, sys);
    return;
  }

  if (!(self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) && mi.idle && now > (mi.idle_time ?? 0)) {
    if (mi.idle_time) {
      mi.idle(self, sys);
      mi.idle_time = now + randomTime(sys, 15, 30);
    } else {
      mi.idle_time = now + randomTime(sys, 0, 15);
    }
  }
}

/** ai_walk: the monster is walking its beat. */
export function ai_walk(self: Entity, dist: number, sys: EntitySystem): void {
  let tempGoal: Entity | null = null;
  if (!self.goalentity && self.monsterinfo.aiflags & AIFlags.GoodGuy) {
    const { forward } = angleVectors(self.angles);
    tempGoal = detachedGoal(add(self.origin, scale(forward, 64)));
    self.goalentity = tempGoal;
  }

  M_MoveToGoal(self, dist, sys);

  if (tempGoal) self.goalentity = null;

  // check for noticing a player
  if (FindTarget(self, sys)) return;

  const mi = self.monsterinfo;
  const now = sys.timeSeconds;
  if (mi.search && now > (mi.idle_time ?? 0)) {
    if (mi.idle_time) {
      mi.search(self, sys);
      mi.idle_time = now + randomTime(sys, 15, 30);
    } else {
      mi.idle_time = now + randomTime(sys, 0, 15);
    }
  }
}

/** ai_charge: turns towards the enemy and advances. A distance of 0 replaces ai_face. */
export function ai_charge(self: Entity, dist: number, sys: EntitySystem): void {
  const mi = self.monsterinfo;
  if (!self.enemy || !self.enemy.inUse) return;

  if (visible(self, self.enemy, sys)) {
    mi.blind_fire_target = add(self.enemy.origin, scale(self.enemy.velocity, -0.1));
  }

  if (!(mi.aiflags & AIFlags.ManualSteering)) {
    self.ideal_yaw = vectoyaw(sub(self.enemy.origin, self.origin));
  }
  M_ChangeYaw(self, sys);

  if (dist || mi.aiflags & AIFlags.AlternateFly) {
    if (mi.aiflags & AIFlags.Charging) {
      M_MoveToGoal(self, dist, sys);
      return;
    }
    // circle strafe support
    if (mi.attack_state === AttackState.Sliding) {
      let ofs: number;
      if (self.enemy?.classname === 'tesla_mine') ofs = 0;
      else if (mi.lefty) ofs = 90;
      else ofs = -90;

      dist *= (mi.current_move as { sidestep_scale?: number } | undefined)?.sidestep_scale ?? 0;

      if (M_walkmove(self, self.ideal_yaw + ofs, dist, sys)) return;

      mi.lefty = mi.lefty ? 0 : 1;
      M_walkmove(self, self.ideal_yaw - ofs, dist, sys);
    } else {
      M_walkmove(self, self.angles.y, dist, sys);
    }
  }

  // [Paril-KEX] if our enemy is right next to us, turn faster so we don't get circled
  if (range_to(self, self.enemy) <= RANGE_MELEE * 2.5) M_ChangeYaw(self, sys);
}

/** ai_turn: don't move, but turn towards ideal_yaw. */
export function ai_turn(self: Entity, dist: number, sys: EntitySystem): void {
  if (dist || self.monsterinfo.aiflags & AIFlags.AlternateFly) M_walkmove(self, self.angles.y, dist, sys);
  if (FindTarget(self, sys)) return;
  if (!(self.monsterinfo.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);
}

/** range_to: the distance between the two boxes. */
export function range_to(self: Entity, other: Entity): number {
  return distanceBetweenBoxes(self.absmin, self.absmax, other.absmin, other.absmax);
}

/** visible: a line from eye to eye that nothing opaque blocks, even if not in front. */
export function visible(self: Entity, other: Entity, sys: EntitySystem, throughGlass = true): boolean {
  if (other.flags & EntityFlags.NoVisible) return false;

  // [Paril-KEX] the invisibility powerup
  if (other.client) {
    if (self.hackflags & HACKFLAG_ATTACK_PLAYER) return self.inUse;
    // fix intermission
    if (!other.solid) return false;
    const client = other.client;
    if ((client.invisible_time ?? 0) > sys.timeSeconds) {
      // can't see us at all after this time
      if ((client.invisibility_fade_time ?? 0) <= sys.timeSeconds) return false;
      // otherwise, throw in some randomness
      if (sys.rng.frandom() > (other.alpha ?? 1)) return false;
    }
  }

  const spot1 = { x: self.origin.x, y: self.origin.y, z: self.origin.z + self.viewheight };
  const spot2 = { x: other.origin.x, y: other.origin.y, z: other.origin.z + other.viewheight };
  let mask = MASK_OPAQUE;
  if (!throughGlass) mask |= CONTENTS_WINDOW;

  const tr = sys.trace(spot1, null, null, spot2, self, mask);
  return tr.fraction === 1 || tr.ent === other;
}

/** infront: within the monster's cone of vision. */
export function infront(self: Entity, other: Entity): boolean {
  const { forward } = angleVectors(self.angles);
  const dot = dotVec3(normalizeVec3(sub(other.origin, self.origin)), forward);

  // [Paril-KEX] an ambush monster has a narrower cone, unless it already had an enemy.
  if (self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH && !self.monsterinfo.trail_time && !self.enemy) return dot > 0.15;
  return dot > -0.3;
}

/** HuntTarget */
export function HuntTarget(self: Entity, sys: EntitySystem, animateState = true): void {
  self.goalentity = self.enemy;
  if (animateState) {
    if (self.monsterinfo.aiflags & AIFlags.StandGround) self.monsterinfo.stand?.(self, sys);
    else self.monsterinfo.run?.(self, sys);
  }
  if (self.enemy) self.ideal_yaw = vectoyaw(sub(self.enemy.origin, self.origin));
}

/** FoundTarget: tell other monsters, then hunt the enemy or run to the combat point. */
export function FoundTarget(self: Entity, sys: EntitySystem): void {
  const enemy = self.enemy;
  if (!enemy) return;
  const mi = self.monsterinfo;
  const now = sys.timeSeconds;

  // let other monsters see this monster for a while
  if (enemy.client) {
    if (enemy.flags & EntityFlags.Disguised) enemy.flags &= ~EntityFlags.Disguised;
    enemy.client.sight_entity = self;
    enemy.client.sight_entity_time = now;
    enemy.show_hostile = now + 1; // wake up other monsters
  }

  // [Paril-KEX] the first time we spot something, a grace period on firing
  if (!mi.trail_time) mi.attack_finished = now + 0.6;
  // give easy/medium a little more reaction time
  mi.attack_finished = (mi.attack_finished ?? 0) + (sys.skill === 0 ? 0.4 : sys.skill === 1 ? 0.2 : 0);

  mi.last_sighting = copy(enemy.origin);
  mi.saved_goal = copy(enemy.origin);
  mi.trail_time = now;
  mi.blind_fire_target = add(mi.last_sighting, scale(enemy.velocity, -0.1));
  mi.blind_fire_delay = 0;
  // [Paril-KEX] for alternate fly, pick a new position immediately
  mi.fly_position_time = 0;

  mi.aiflags &= ~AIFlags.ThirdEye;

  // Paril: heading to a combat point or path corner; don't hunt the new target yet.
  if (mi.aiflags & AIFlags.CombatPoint) return;

  if (!self.combattarget) {
    HuntTarget(self, sys);
    return;
  }

  const target = G_PickTarget(self.combattarget, sys);
  self.goalentity = self.movetarget = target;
  if (!self.movetarget) {
    self.goalentity = self.movetarget = self.enemy;
    HuntTarget(self, sys);
    return;
  }

  // clear out our combattarget, these are a one shot deal
  self.combattarget = undefined;
  mi.aiflags |= AIFlags.CombatPoint;
  mi.pausetime = 0;
  // run for it
  mi.run?.(self, sys);
}

/** [Paril-KEX] AI_GetMonsterAlertedByPlayers: a monster a player alerted this frame, if we can see it. */
function AI_GetMonsterAlertedByPlayers(self: Entity, sys: EntitySystem): Entity | null {
  for (const player of activePlayers(sys)) {
    if (isDead(player)) continue;
    const client = player.client!;
    if (!client.sight_entity || !withinLastFrame(client.sight_entity_time, sys)) continue;
    if (!visible(self, client.sight_entity, sys)) continue;
    return client.sight_entity;
  }
  return null;
}

/** [Paril-KEX] AI_GetSoundClient: the closest player noise made this frame. */
function AI_GetSoundClient(self: Entity, direct: boolean, sys: EntitySystem): Entity | null {
  let best: Entity | null = null;
  let bestDistance = Number.MAX_VALUE;
  for (const player of activePlayers(sys)) {
    if (isDead(player)) continue;
    const client = player.client!;
    const sound = direct ? client.sound_entity : client.sound2_entity;
    if (!sound) continue;
    if (!withinLastFrame(direct ? client.sound_entity_time : client.sound2_entity_time, sys)) continue;
    const dist = len(sub(self.origin, sound.origin));
    if (!best || dist < bestDistance) {
      bestDistance = dist;
      best = sound;
    }
  }
  return best;
}

/** Monsters woken by a player another monster saw, if close enough; they need not see it. */
function sourceVisible(self: Entity, client: Entity, sys: EntitySystem): boolean {
  const r = range_to(self, client);
  if (r > RANGE_MID) return false;
  return (
    (r <= RANGE_NEAR && client.show_hostile >= sys.timeSeconds && !(self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH)) ||
    (visible(self, client, sys) && (r <= RANGE_MELEE || !!(self.monsterinfo.aiflags & AIFlags.ThirdEye) || infront(self, client)))
  );
}

/** G_MonsterSourceVisible */
export const G_MonsterSourceVisible = sourceVisible;

/**
 * FindTarget: self is not attacking anything, so try to find a target. Returns true if an
 * enemy was sighted.
 */
export function FindTarget(self: Entity, sys: EntitySystem): boolean {
  const mi = self.monsterinfo;
  let ignoreSightSound = false;

  if (mi.aiflags & AIFlags.GoodGuy) {
    // FIXME look for monsters?
    return false;
  }

  // if we're going to a combat point, just proceed
  if (mi.aiflags & AIFlags.CombatPoint) return false;

  let heardit = false;
  let client: Entity | null;

  // Paril: consider the current sight client first if we can see it; this stops them dancing
  // in front of you if you fire every frame.
  if ((client = AI_GetSightClient(self, sys))) {
    if (client === self.enemy) return false;
  }
  // check indirect sources
  if (!client) {
    // monsters that were alerted by players; we can only be alerted if we can see them
    if (!(self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) && (client = AI_GetMonsterAlertedByPlayers(self, sys))) {
      if (client.enemy === self.enemy || !sourceVisible(self, client, sys)) client = null;
    }

    if (!client) {
      const level = sys.level as { disguise_violation_time?: number; disguise_violator?: Entity | null } | undefined;
      if ((level?.disguise_violation_time ?? 0) > sys.timeSeconds) {
        client = level?.disguise_violator ?? null;
      } else if ((client = AI_GetSoundClient(self, true, sys))) {
        heardit = true;
      } else if (!self.enemy && !(self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) && (client = AI_GetSoundClient(self, false, sys))) {
        heardit = true;
      }
    }
  }

  if (!client) return false; // no clients to get mad at
  if (!client.inUse) return false;

  if (client === self.enemy) {
    let skipFound = true;
    // [Paril-KEX] going to a sound and hearing a new one: player noises are reused, so it
    // can look like the "same" enemy.
    if (heardit && mi.aiflags & AIFlags.SoundTarget) {
      self.ideal_yaw = vectoyaw(sub(client.origin, self.origin));
      if (!FacingIdeal(self)) skipFound = false;
      else if (!SV_CloseEnough(self, client, 8)) skipFound = false;
      if (!skipFound && mi.aiflags & AIFlags.TempStandGround) {
        mi.aiflags &= ~(AIFlags.StandGround | AIFlags.TempStandGround);
      }
    }
    if (skipFound) return true;
  }

  // ROGUE - hintpath coop fix
  if (mi.aiflags & AIFlags.HintPath && sys.coop) heardit = false;

  if (client.svflags & ServerFlags.Monster) {
    if (!client.enemy) return false;
    if (client.enemy.flags & EntityFlags.NoTarget) return false;
  } else if (heardit) {
    if (client.owner && client.owner.flags & EntityFlags.NoTarget) return false;
  } else if (!client.client) {
    return false;
  }

  if (!heardit) {
    if (!sourceVisible(self, client, sys)) return false;

    self.enemy = client;

    if (self.enemy.classname !== 'player_noise') {
      mi.aiflags &= ~AIFlags.SoundTarget;
      if (!self.enemy.client) {
        self.enemy = self.enemy.enemy;
        if (!self.enemy?.client) {
          self.enemy = null;
          return false;
        }
      }
    }

    const ec = self.enemy.client;
    if (ec && (ec.invisible_time ?? 0) > sys.timeSeconds && (ec.invisibility_fade_time ?? 0) <= sys.timeSeconds) {
      self.enemy = null;
      return false;
    }

    if (mi.close_sight_tripped) ignoreSightSound = true;
    else mi.close_sight_tripped = true;
  } else {
    if (self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) {
      if (!visible(self, client, sys)) return false;
    } else if (!sys.inPHS(self.origin, client.origin)) {
      return false;
    }

    const temp = sub(client.origin, self.origin);
    if (len(temp) > 1000) return false; // too far to hear

    // (the C also checks gi.AreasConnected here; area portals are not ported yet)

    self.ideal_yaw = vectoyaw(temp);
    if (!(mi.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);

    // hunt the sound for a bit; hopefully find the real player
    mi.aiflags |= AIFlags.SoundTarget;
    self.enemy = client;
  }

  // got one (hint paths are not ported, so always FoundTarget)
  FoundTarget(self, sys);

  if (!(mi.aiflags & AIFlags.SoundTarget) && mi.sight && !ignoreSightSound) mi.sight(self, self.enemy!);

  return true;
}

/** M_CheckAttack_Base: the shared "do I attack now" roll, split out for the bosses. */
export function M_CheckAttack_Base(
  self: Entity,
  sys: EntitySystem,
  standGroundChance: number,
  meleeChance: number,
  nearChance: number,
  midChance: number,
  farChance: number,
  strafeScalar: number,
): boolean {
  const enemy = self.enemy!;
  const mi = self.monsterinfo;
  const now = sys.timeSeconds;

  if (enemy.flags & EntityFlags.NoVisible) return false;

  if (enemy.health > 0) {
    if (enemy.client && (enemy.client.invisible_time ?? 0) > now) {
      if ((enemy.client.invisibility_fade_time ?? 0) <= now) return false;
    }

    const spot1 = { x: self.origin.x, y: self.origin.y, z: self.origin.z + self.viewheight };
    let tr: { ent: Entity | null; fraction: number; allsolid?: boolean; startsolid?: boolean };
    // see if any entities are in the way of the shot
    if (!enemy.client || enemy.solid) {
      const spot2 = { x: enemy.origin.x, y: enemy.origin.y, z: enemy.origin.z + enemy.viewheight };
      tr = sys.trace(spot1, null, null, spot2, self, MASK_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_SLIME | CONTENTS_LAVA);
    } else {
      tr = { ent: sys.world, fraction: 0 };
    }

    const hitEnt = tr.ent ?? sys.world;
    // do we have a clear shot?
    if (!(self.hackflags & HACKFLAG_ATTACK_PLAYER) && hitEnt !== enemy && !(hitEnt.svflags & ServerFlags.Player)) {
      // ROGUE - go ahead and shoot at info_notnulls if they can.
      if (enemy.solid !== Solid.Not || tr.fraction < 1) {
        // PMM - can't see the target and not blocked by a monster: blind fire if we have
        // seen them once.
        if (!(hitEnt.svflags & ServerFlags.Monster) && !visible(self, enemy, sys) && mi.had_visibility) {
          if (mi.blindfire && (mi.blind_fire_delay ?? 0) <= 20) {
            if (now < (mi.attack_finished ?? 0)) return false;
            if (now < mi.trail_time + (mi.blind_fire_delay ?? 0)) return false; // wait for our time
            // make sure we're not going to shoot a monster
            const bt = sys.trace(spot1, null, null, mi.blind_fire_target ?? enemy.origin, self, CONTENTS_MONSTER);
            if (bt.allsolid || bt.startsolid || (bt.fraction < 1 && bt.ent !== enemy)) return false;
            mi.attack_state = AttackState.Blind;
            return true;
          }
        }
        return false;
      }
    }
  }

  const enemyRange = range_to(self, enemy);

  // melee attack
  if (enemyRange <= RANGE_MELEE) {
    if (mi.melee && (mi.melee_debounce_time ?? 0) <= now) mi.attack_state = AttackState.Melee;
    else mi.attack_state = AttackState.Missile;
    return true;
  }

  // if we were in melee just before this but we're too far away, get out of melee state now
  if (mi.attack_state === AttackState.Melee && (mi.melee_debounce_time ?? 0) > now) mi.attack_state = AttackState.Missile;

  // missile attack
  if (!mi.attack) {
    mi.attack_state = AttackState.Straight;
    return false;
  }

  if (now < (mi.attack_finished ?? 0)) return false;

  let chance: number;
  if (mi.aiflags & AIFlags.StandGround) chance = standGroundChance;
  else if (enemyRange <= RANGE_MELEE) chance = meleeChance;
  else if (enemyRange <= RANGE_NEAR) chance = nearChance;
  else if (enemyRange <= RANGE_MID) chance = midChance;
  else chance = farChance;

  // PGM - go ahead and shoot every time if it's an info_notnull
  if ((!enemy.client && enemy.solid === Solid.Not) || sys.rng.frandom() < chance) {
    mi.attack_state = AttackState.Missile;
    mi.attack_finished = now;
    return true;
  }

  // ROGUE - flyers strafe more
  if (self.flags & EntityFlags.Fly) {
    if ((mi.strafe_check_time ?? 0) <= now) {
      let strafeChance = self.classname === 'monster_daedalus' ? 0.8 : 0.6;
      if (enemy.classname === 'tesla_mine') strafeChance = 0;
      else strafeChance *= strafeScalar;

      if (strafeChance) {
        let newState = AttackState.Straight;
        if (sys.rng.frandom() < strafeChance) newState = AttackState.Sliding;
        if (newState !== mi.attack_state) {
          mi.strafe_check_time = now + randomTime(sys, 1, 3);
          mi.attack_state = newState;
        }
      }
    }
  } else if (!(mi.aiflags & AIFlags.Pathing)) {
    // [Paril-KEX] no strafing for walkers
    mi.attack_state = AttackState.Straight;
  }

  return false;
}

/** M_CheckAttack */
export function M_CheckAttack(self: Entity, sys: EntitySystem): boolean {
  return M_CheckAttack_Base(self, sys, 0.7, 0.4, 0.25, 0.06, 0, 1.0);
}

/** ai_run_melee: turn and close until within an angle to launch a melee attack. */
export function ai_run_melee(self: Entity, sys: EntitySystem): void {
  self.ideal_yaw = enemy_yaw;
  if (!(self.monsterinfo.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);
  if (FacingIdeal(self)) {
    self.monsterinfo.melee?.(self, sys);
    self.monsterinfo.attack_state = AttackState.Straight;
  }
}

/** ai_run_missile: turn in place until within an angle to launch a missile attack. */
export function ai_run_missile(self: Entity, sys: EntitySystem): void {
  const mi = self.monsterinfo;
  self.ideal_yaw = enemy_yaw;
  if (!(mi.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);
  if (FacingIdeal(self)) {
    if (mi.attack) {
      mi.attack(self, sys);
      mi.attack_finished = sys.timeSeconds + randomTime(sys, 1, 2);
    }
    if (mi.attack_state === AttackState.Missile || mi.attack_state === AttackState.Blind) mi.attack_state = AttackState.Straight;
  }
}

/** monster_done_dodge */
function monster_done_dodge(self: Entity): void {
  self.monsterinfo.aiflags &= ~AIFlags.Dodging;
  if (self.monsterinfo.attack_state === AttackState.Sliding) self.monsterinfo.attack_state = AttackState.Straight;
}

/** ai_run_slide: strafe sideways, staying at about the same range. */
export function ai_run_slide(self: Entity, distance: number, sys: EntitySystem): void {
  const mi = self.monsterinfo;
  self.ideal_yaw = enemy_yaw;
  const ofs = mi.lefty ? 90 : -90;

  if (!(mi.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);

  // PMM - clamp maximum sideways move for non flyers to make them look less jerky
  if (!(self.flags & EntityFlags.Fly)) distance = Math.min(distance, MAX_SIDESTEP / ((sys.frameTimeSeconds * 1000 || 25) / 10));
  if (M_walkmove(self, self.ideal_yaw + ofs, distance, sys)) return;
  // PMM - if we're dodging, give up on it and go straight
  if (mi.aiflags & AIFlags.Dodging) {
    monster_done_dodge(self);
    mi.attack_state = AttackState.Straight;
    return;
  }

  mi.lefty = mi.lefty ? 0 : 1;
  if (M_walkmove(self, self.ideal_yaw - ofs, distance, sys)) return;
  if (mi.aiflags & AIFlags.Dodging) monster_done_dodge(self);

  // the move failed, so signal the caller (ai_run) to try going straight
  mi.attack_state = AttackState.Straight;
}

/** ai_checkattack: decides if we're going to attack or do something else. */
export function ai_checkattack(self: Entity, _dist: number, sys: EntitySystem): boolean {
  const mi = self.monsterinfo;
  const now = sys.timeSeconds;

  if (mi.aiflags & AIFlags.TempStandGround) mi.aiflags &= ~(AIFlags.StandGround | AIFlags.TempStandGround);

  // this causes monsters to run blindly to the combat point w/o firing
  if (self.goalentity) {
    if (mi.aiflags & AIFlags.CombatPoint) {
      if (self.enemy && range_to(self, self.enemy) > 100) return false;
    }

    if (mi.aiflags & AIFlags.SoundTarget && self.enemy) {
      if (now - self.enemy.teleport_time > 5) {
        if (self.goalentity === self.enemy) self.goalentity = self.movetarget ?? null;
        mi.aiflags &= ~AIFlags.SoundTarget;
      } else {
        self.enemy.show_hostile = now + 1;
        return false;
      }
    }
  }

  enemy_vis = false;

  // see if the enemy is dead
  let hesDeadJim = false;
  if (!self.enemy || !self.enemy.inUse) {
    hesDeadJim = true;
  } else if (mi.forget_enemy) {
    mi.forget_enemy = false;
    hesDeadJim = true;
  } else if (mi.aiflags & AIFlags.Medic) {
    if (!self.enemy.inUse || self.enemy.health > 0) hesDeadJim = true;
  } else {
    if (!(mi.aiflags & AIFlags.Brutal) && self.enemy.health <= 0) hesDeadJim = true;
    // [Paril-KEX] if our enemy was invisible, lose sight now
    const ec = self.enemy.client;
    if (ec && (ec.invisible_time ?? 0) > now && (ec.invisibility_fade_time ?? 0) <= now && mi.aiflags & AIFlags.PursueNext) {
      hesDeadJim = true;
    }
  }

  if (hesDeadJim && !(self.hackflags & HACKFLAG_ATTACK_PLAYER)) {
    mi.aiflags &= ~AIFlags.Medic;
    self.enemy = self.goalentity = null;
    mi.close_sight_tripped = false;
    if (self.oldenemy && self.oldenemy.health > 0) {
      self.enemy = self.oldenemy;
      self.oldenemy = null;
      HuntTarget(self, sys);
    } else if (mi.last_player_enemy && mi.last_player_enemy.health > 0) {
      // ROGUE - multiple teslas make monsters lose track of the player.
      self.enemy = mi.last_player_enemy;
      self.oldenemy = null;
      mi.last_player_enemy = null;
      HuntTarget(self, sys);
    } else {
      if (self.movetarget && !(mi.aiflags & AIFlags.StandGround)) {
        self.goalentity = self.movetarget;
        mi.walk?.(self, sys);
      } else {
        // the pausetime stops the stand code reverting to walking with no target
        mi.pausetime = HOLD_FOREVER;
        mi.stand?.(self, sys);
        if (mi.aiflags & AIFlags.TempStandGround) mi.aiflags &= ~(AIFlags.StandGround | AIFlags.TempStandGround);
      }
      return true;
    }
  }

  const enemy = self.enemy!;

  // check knowledge of enemy
  enemy_vis = visible(self, enemy, sys);
  if (enemy_vis) {
    mi.had_visibility = true;
    enemy.show_hostile = now + 1; // wake up other monsters
    mi.search_time = now + 5;
    clearLostSight(self, sys);
    recordSighting(self, sys);
  }

  enemy_infront = infront(self, enemy);
  enemy_yaw = vectoyaw(sub(enemy.origin, self.origin));

  // PMM - the monster's checkattack runs before run_missile/melee, so they can attack while
  // strafing or in ai_run
  let retval = false;
  if ((mi.checkattack_time ?? 0) <= now) {
    mi.checkattack_time = now + 0.1;
    retval = (mi.checkattack ?? M_CheckAttack)(self, sys);
  }

  if (retval || (mi.attack_state ?? 0) >= AttackState.Missile) {
    if (mi.attack_state === AttackState.Missile) {
      ai_run_missile(self, sys);
      return true;
    }
    if (mi.attack_state === AttackState.Melee) {
      ai_run_melee(self, sys);
      return true;
    }
    // PMM -- added so monsters can shoot blind
    if (mi.attack_state === AttackState.Blind) {
      ai_run_missile(self, sys);
      return true;
    }
    // if enemy is not currently visible, we will never attack
    if (!enemy_vis) return false;
  }

  return retval;
}

/** A goal entity that lives outside the entity pool (see the file comment). */
function detachedGoal(origin: Vec3): Entity {
  const goal = new Entity(-1);
  goal.inUse = true;
  goal.origin = copy(origin);
  goal.absmin = copy(origin);
  goal.absmax = copy(origin);
  return goal;
}

/** PlayerTrail_Pick: the player trail is not ported yet. */
function PlayerTrail_Pick(_self: Entity, _next: boolean): Entity | null {
  return null;
}

/** ai_run: the monster has an enemy it is trying to kill. */
export function ai_run(self: Entity, dist: number, sys: EntitySystem): void {
  const mi = self.monsterinfo;
  const now = sys.timeSeconds;
  let alreadyMoved = false;

  // if we're going to a combat point, just proceed
  if (mi.aiflags & AIFlags.CombatPoint) {
    ai_checkattack(self, dist, sys);
    M_MoveToGoal(self, dist, sys);

    if (self.movetarget) {
      // nb: this is done from the centroid and not viewheight on purpose
      const centre = scale(add(self.absmax, self.absmin), 0.5);
      const tr = sys.trace(centre, { x: -2, y: -2, z: -2 }, { x: 2, y: 2, z: 2 }, self.movetarget.origin, self, CONTENTS_SOLID);

      // [Paril-KEX] stand ground and knocked too far from our path_corner, or can't see it.
      const away = len(sub(closestPointToBox(self.movetarget.origin, self.absmin, self.absmax), self.movetarget.origin));
      if (mi.reached_hold_combat && (away > 160 || (tr.fraction < 1 && (tr.plane?.normal.z ?? 0) <= 0.7))) {
        mi.aiflags &= ~AIFlags.CombatPoint;
        self.movetarget = null;
        self.target = undefined;
        self.goalentity = self.enemy;
      } else {
        return;
      }
    } else {
      return;
    }
  }

  // PMM
  if (mi.aiflags & AIFlags.Ducked && mi.unduck) mi.unduck(self);

  if (mi.aiflags & AIFlags.SoundTarget) {
    const touchingNoise = !!self.enemy && SV_CloseEnough(self, self.enemy, dist * (1 / ((sys.frameTimeSeconds || 0.025) * 10)));

    if (!self.enemy || (touchingNoise && FacingIdeal(self))) {
      mi.aiflags |= AIFlags.StandGround | AIFlags.TempStandGround;
      self.angles = { ...self.angles, y: self.ideal_yaw };
      mi.stand?.(self, sys);
      mi.close_sight_tripped = false;
      return;
    }

    // if we're close to the goal, just turn
    if (touchingNoise) M_ChangeYaw(self, sys);
    else M_MoveToGoal(self, dist, sys);

    alreadyMoved = true;
    if (!self.inUse) return;

    if (!FindTarget(self, sys)) return;
  }

  // PMM -- ai_checkattack up here so the monsters can attack while strafing or charging
  const retval = ai_checkattack(self, dist, sys);

  // PMM - don't strafe if we can't see our enemy
  if (!enemy_vis && mi.attack_state === AttackState.Sliding) mi.attack_state = AttackState.Straight;
  // unless we're dodging (dodging out of view looks smart)
  if (mi.aiflags & AIFlags.Dodging) mi.attack_state = AttackState.Sliding;

  if (mi.attack_state === AttackState.Sliding) {
    if (!alreadyMoved) ai_run_slide(self, dist, sys);
    // a successful slide that keeps us sliding is our move for this frame
    if (!retval && mi.attack_state === AttackState.Sliding) return;
  } else if (mi.aiflags & AIFlags.Charging) {
    self.ideal_yaw = enemy_yaw;
    if (!(mi.aiflags & AIFlags.ManualSteering)) M_ChangeYaw(self, sys);
  }

  if (retval) {
    if ((dist || mi.aiflags & AIFlags.AlternateFly) && !alreadyMoved && mi.attack_state === AttackState.Straight && !(mi.aiflags & AIFlags.StandGround)) {
      M_MoveToGoal(self, dist, sys);
    }
    if (self.enemy && self.enemy.inUse && enemy_vis) {
      clearLostSight(self, sys);
      recordSighting(self, sys);
    }
    return;
  }

  if (self.enemy && self.enemy.inUse && enemy_vis) {
    if (!alreadyMoved) M_MoveToGoal(self, dist, sys);
    if (!self.inUse) return;

    clearLostSight(self, sys);
    recordSighting(self, sys);

    // [Paril-KEX] if our enemy is right next to us, turn faster so we don't get circled
    if (range_to(self, self.enemy) <= RANGE_MELEE * 2.5) M_ChangeYaw(self, sys);
    return;
  }

  // (hint paths: monsterlost_checkhint is not ported)

  // coop will change to another enemy if visible
  if (sys.coop) FindTarget(self, sys);

  if (mi.search_time && now > mi.search_time + 20) {
    if (!alreadyMoved) M_MoveToGoal(self, dist, sys);
    mi.search_time = 0;
    return;
  }

  const save = self.goalentity;
  const tempgoal = detachedGoal(self.origin);
  self.goalentity = tempgoal;

  let newEnemy = false;

  if (!(mi.aiflags & AIFlags.LostSight)) {
    // just lost sight of the player, decide where to go first
    mi.aiflags |= AIFlags.LostSight | AIFlags.PursuitLastSeen;
    mi.aiflags &= ~(AIFlags.PursueNext | AIFlags.PursueTemp);
    newEnemy = true;
    // immediately try paths
    mi.path_blocked_counter = 0;
    mi.path_wait_time = 0;
  }

  if (mi.aiflags & AIFlags.PursueNext) {
    mi.aiflags &= ~AIFlags.PursueNext;

    // give ourself more time since we got this far
    mi.search_time = now + 5;

    let marker: Entity | null = null;
    if (mi.aiflags & AIFlags.PursueTemp) {
      mi.aiflags &= ~AIFlags.PursueTemp;
      marker = null;
      mi.last_sighting = copy(mi.saved_goal ?? mi.last_sighting);
      newEnemy = true;
    } else if (mi.aiflags & AIFlags.PursuitLastSeen) {
      mi.aiflags &= ~AIFlags.PursuitLastSeen;
      marker = PlayerTrail_Pick(self, false);
    } else {
      marker = PlayerTrail_Pick(self, true);
    }

    if (marker) {
      mi.last_sighting = copy(marker.origin);
      mi.trail_time = marker.timestamp;
      self.ideal_yaw = marker.angles.y;
      self.angles = { ...self.angles, y: marker.angles.y };
      newEnemy = true;
    }
  }

  if (
    !(mi.aiflags & AIFlags.Pathing) &&
    boxesIntersect(mi.last_sighting, mi.last_sighting, add(self.origin, self.mins), add(self.origin, self.maxs))
  ) {
    mi.aiflags |= AIFlags.PursueNext;
    dist = Math.min(dist, len(sub(self.origin, mi.last_sighting)));
    // [Paril-KEX] helps them navigate corners when two next pursuits are close together
    mi.random_change_time = now + 0.1;
  }

  tempgoal.origin = copy(mi.last_sighting);
  tempgoal.absmin = copy(mi.last_sighting);
  tempgoal.absmax = copy(mi.last_sighting);

  if (newEnemy) {
    let tr = sys.trace(self.origin, self.mins, self.maxs, mi.last_sighting, self, MASK_PLAYERSOLID);
    if (tr.fraction < 1) {
      let v = sub(tempgoal.origin, self.origin);
      const d1 = len(v);
      let center = tr.fraction;
      const d2 = d1 * ((center + 1) / 2);
      const backupYaw = self.angles.y;
      self.ideal_yaw = vectoyaw(v);
      self.angles = { ...self.angles, y: self.ideal_yaw };
      const { forward, right: rightVec } = angleVectors(self.angles);

      let leftTarget = projectSourceVec3(self.origin, { x: d2, y: -16, z: 0 }, forward, rightVec);
      tr = sys.trace(self.origin, self.mins, self.maxs, leftTarget, self, MASK_PLAYERSOLID);
      const left = tr.fraction;

      let rightTarget = projectSourceVec3(self.origin, { x: d2, y: 16, z: 0 }, forward, rightVec);
      tr = sys.trace(self.origin, self.mins, self.maxs, rightTarget, self, MASK_PLAYERSOLID);
      const right = tr.fraction;

      center = (d1 * center) / d2;
      if (left >= center && left > right) {
        if (left < 1) leftTarget = projectSourceVec3(self.origin, { x: d2 * left * 0.5, y: -16, z: 0 }, forward, rightVec);
        mi.saved_goal = copy(mi.last_sighting);
        mi.aiflags |= AIFlags.PursueTemp;
        tempgoal.origin = copy(leftTarget);
        mi.last_sighting = copy(leftTarget);
        v = sub(tempgoal.origin, self.origin);
        self.ideal_yaw = vectoyaw(v);
      } else if (right >= center && right > left) {
        if (right < 1) rightTarget = projectSourceVec3(self.origin, { x: d2 * right * 0.5, y: 16, z: 0 }, forward, rightVec);
        mi.saved_goal = copy(mi.last_sighting);
        mi.aiflags |= AIFlags.PursueTemp;
        tempgoal.origin = copy(rightTarget);
        mi.last_sighting = copy(rightTarget);
        v = sub(tempgoal.origin, self.origin);
        self.ideal_yaw = vectoyaw(v);
      }
      tempgoal.absmin = copy(tempgoal.origin);
      tempgoal.absmax = copy(tempgoal.origin);
      self.angles = { ...self.angles, y: backupYaw };
    }
  }

  M_MoveToGoal(self, dist, sys);

  if (!self.inUse) return;
  self.goalentity = save;
}
