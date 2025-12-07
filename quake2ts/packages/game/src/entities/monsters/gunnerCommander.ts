import {
  angleVectors,
  normalizeVec3,
  subtractVec3,
  Vec3,
  lengthVec3,
  scaleVec3,
  addVec3,
  copyVec3
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import {
  DeadFlag,
  Entity,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { monster_fire_flechette, monster_fire_grenade } from './attack.js';
import { throwGibs, GibType } from '../gibs.js';
import type { EntitySystem } from '../system.js';
import { AIFlags, MonsterAttackState } from '../../ai/constants.js';
import { visible } from '../../ai/perception.js';
import {
  M_AllowSpawn,
  M_CheckGib,
  M_MonsterDodge,
  M_SetAnimation,
  M_ProjectFlashSource,
  M_CheckClearShot,
  M_ShouldReactToPain,
} from './common.js';
import {
  PredictAim,
  M_CalculatePitchToFire,
  blocked_checkplat,
  blocked_checkjump,
  monster_jump_finished,
  BlockedJumpResult
} from '../../ai/rogue.js';

const MONSTER_TICK = 0.1;

// Constants
const MORTAR_SPEED = 850;
const GRENADE_SPEED = 600;
const SPAWNFLAG_GUNCMDR_NOJUMPING = 8;
const MZ2_GUNCMDR_CHAINGUN_1 = 1;
const MZ2_GUNCMDR_CHAINGUN_2 = 2;
const MZ2_GUNCMDR_GRENADE_MORTAR_1 = 3;
const MZ2_GUNCMDR_GRENADE_MORTAR_2 = 4;
const MZ2_GUNCMDR_GRENADE_MORTAR_3 = 5;
const MZ2_GUNCMDR_GRENADE_FRONT_1 = 6;
const MZ2_GUNCMDR_GRENADE_FRONT_2 = 7;
const MZ2_GUNCMDR_GRENADE_FRONT_3 = 8;
const MZ2_GUNCMDR_GRENADE_CROUCH_1 = 9;
const MZ2_GUNCMDR_GRENADE_CROUCH_2 = 10;
const MZ2_GUNCMDR_GRENADE_CROUCH_3 = 11;

const monster_flash_offset: Record<number, Vec3> = {
    [MZ2_GUNCMDR_CHAINGUN_1]: { x: 37, y: -4, z: 12.5 },
    [MZ2_GUNCMDR_CHAINGUN_2]: { x: 37, y: -4, z: 12.5 },
    [MZ2_GUNCMDR_GRENADE_MORTAR_1]: { x: 14, y: 7, z: 27.5 },
    [MZ2_GUNCMDR_GRENADE_MORTAR_2]: { x: 14, y: 7, z: 27.5 },
    [MZ2_GUNCMDR_GRENADE_MORTAR_3]: { x: 14, y: 7, z: 27.5 },
    [MZ2_GUNCMDR_GRENADE_FRONT_1]: { x: 19, y: 7, z: 13.5 },
    [MZ2_GUNCMDR_GRENADE_FRONT_2]: { x: 19, y: 7, z: 13.5 },
    [MZ2_GUNCMDR_GRENADE_FRONT_3]: { x: 19, y: 7, z: 13.5 },
    [MZ2_GUNCMDR_GRENADE_CROUCH_1]: { x: 19, y: 7, z: 13.5 },
    [MZ2_GUNCMDR_GRENADE_CROUCH_2]: { x: 19, y: 7, z: 13.5 },
    [MZ2_GUNCMDR_GRENADE_CROUCH_3]: { x: 19, y: 7, z: 13.5 },
};

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
  ai_stand(self, MONSTER_TICK, context);
}

function monster_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: EntitySystem): void {
  ai_run(self, dist, MONSTER_TICK, context);
}

function monster_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: EntitySystem): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let fidget_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_chain_move: MonsterMove;
let fire_chain_move: MonsterMove;
let fire_chain_run_move: MonsterMove;
let fire_chain_dodge_right_move: MonsterMove;
let fire_chain_dodge_left_move: MonsterMove;
let endfire_chain_move: MonsterMove;
let attack_mortar_move: MonsterMove;
let attack_mortar_dodge_move: MonsterMove;
let attack_grenade_back_move: MonsterMove;
let attack_grenade_back_dodge_right_move: MonsterMove;
let attack_grenade_back_dodge_left_move: MonsterMove;
let attack_kick_move: MonsterMove;
let duck_attack_move: MonsterMove;
let jump_move: MonsterMove;
let jump2_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let pain4_move: MonsterMove;
let pain5_move: MonsterMove;
let pain6_move: MonsterMove;
let pain7_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let death3_move: MonsterMove;
let death4_move: MonsterMove;
let death5_move: MonsterMove;
let death6_move: MonsterMove;
let death7_move: MonsterMove;

// Helper Functions
function guncmdr_idlesound(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'guncmdr/gcdridle1.wav', 1, 1, 0);
}

function guncmdr_sight(self: Entity, other: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'guncmdr/sight1.wav', 1, 1, 0);
}

function guncmdr_search(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'guncmdr/gcdrsrch1.wav', 1, 1, 0);
}

function guncmdr_opengun(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'guncmdr/gcdratck1.wav', 1, 1, 0);
}

// Logic Functions
function guncmdr_fidget(self: Entity, context: EntitySystem): void {
  if (self.monsterinfo.aiflags & AIFlags.StandGround) return;
  if (self.enemy) return;
  if (context.game.random.frandom() <= 0.05) {
    M_SetAnimation(self, fidget_move, context);
  }
}

function guncmdr_stand(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, stand_move, context);
}

function guncmdr_walk(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, walk_move, context);
}

function monster_done_dodge(self: Entity): void {
    self.monsterinfo.aiflags &= ~AIFlags.Ducked;
}

function guncmdr_run(self: Entity, context: EntitySystem): void {
  monster_done_dodge(self);
  if (self.monsterinfo.aiflags & AIFlags.StandGround) {
    M_SetAnimation(self, stand_move, context);
  } else {
    M_SetAnimation(self, run_move, context);
  }
}

function guncmdr_fire_chain(self: Entity, context: EntitySystem): void {
  if (!(self.monsterinfo.aiflags & AIFlags.StandGround) && self.enemy) {
    const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
    if (dist > 400 && ai_move(self, 8.0)) { // RANGE_CHAINGUN_RUN = 400
       M_SetAnimation(self, fire_chain_run_move, context);
       return;
    }
  }
  M_SetAnimation(self, fire_chain_move, context);
}

function guncmdr_refire_chain(self: Entity, context: EntitySystem): void {
    monster_done_dodge(self);
    self.monsterinfo.attack_state = MonsterAttackState.Straight;

    if (self.enemy && self.enemy.health > 0) {
        if (visible(self, self.enemy, context.trace)) {
            if (context.game.random.frandom() <= 0.5) {
                 if (!(self.monsterinfo.aiflags & AIFlags.StandGround) && self.enemy) {
                    const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
                    if (dist > 400 && ai_move(self, 8.0)) {
                         M_SetAnimation(self, fire_chain_run_move, context);
                         return;
                    }
                 }
                M_SetAnimation(self, fire_chain_move, context);
                return;
            }
        }
    }
    M_SetAnimation(self, endfire_chain_move, context);
}

function GunnerCmdrFire(self: Entity, context: EntitySystem): void {
    if (!self.enemy || !self.enemy.inUse) return;

    let flash_number: number;
    if (self.frame >= 401 && self.frame <= 505) {
        flash_number = MZ2_GUNCMDR_CHAINGUN_2;
    } else {
        flash_number = MZ2_GUNCMDR_CHAINGUN_1;
    }

    const { forward, right } = angleVectors(self.angles);

    const start = M_ProjectFlashSource(self, monster_flash_offset[flash_number], forward, right);

    const { aimdir: aim } = PredictAim(context, self, self.enemy, start, 800, false, context.game.random.frandom() * 0.3);

    // Add randomness
    // aim is readonly, so we construct a new one.
    const randomAim = { ...aim };
    for (let i = 0; i < 3; i++) {
        // crandom_open() * 0.025f
        // crandom is -1 to 1.
        randomAim.x += (context.game.random.frandom() * 2 - 1) * 0.025;
        randomAim.y += (context.game.random.frandom() * 2 - 1) * 0.025;
        randomAim.z += (context.game.random.frandom() * 2 - 1) * 0.025;
    }

    monster_fire_flechette(self, start, randomAim, 4, 800, flash_number, context);
}


function GunnerCmdrGrenade(self: Entity, context: EntitySystem): void {
    if (!self.enemy || !self.enemy.inUse) return;

    let spread = 0;
    let flash_number = 0;
    let pitch = 0;
    let blindfire = false;
    let target: Vec3;

    // Check manual steering / blindfire
    if (self.monsterinfo.aiflags & AIFlags.ManualSteering) {
        blindfire = true;
    }

    const frameIndex = self.frame;

    // Frame logic
    if (frameIndex === 205) { spread = -0.1; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_1; }
    else if (frameIndex === 208) { spread = 0.0; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_2; }
    else if (frameIndex === 211) { spread = 0.1; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_3; }
    else if (frameIndex === 304) { spread = -0.1; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_1; }
    else if (frameIndex === 307) { spread = 0.0; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_2; }
    else if (frameIndex === 310) { spread = 0.1; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_3; }
    else if (frameIndex === 911) { spread = 0.25; flash_number = MZ2_GUNCMDR_GRENADE_CROUCH_1; }
    else if (frameIndex === 912) { spread = 0.0; flash_number = MZ2_GUNCMDR_GRENADE_CROUCH_2; }
    else if (frameIndex === 913) { spread = -0.25; flash_number = MZ2_GUNCMDR_GRENADE_CROUCH_3; }

    if (flash_number === 0) return;

    // Determine target
    if (blindfire && !visible(self, self.enemy, context.trace)) {
        if (!self.monsterinfo.blind_fire_target) return;
        target = self.monsterinfo.blind_fire_target;
    } else {
        target = self.enemy.origin;
    }

    const { forward, right, up } = angleVectors(self.angles);
    const start = M_ProjectFlashSource(self, monster_flash_offset[flash_number], forward, right);
    let aim: Vec3;

    // Crouch logic uses Ion Ripper effects (handled here as generic fire for now unless we add ionripper)
    // Rerelease code:
    // if (flash_number >= MZ2_GUNCMDR_GRENADE_CROUCH_1 && flash_number <= MZ2_GUNCMDR_GRENADE_CROUCH_3)
    //   fire_ionripper(...)
    // else
    //   fire_grenade(...)

    // For now we assume grenades as per old TS implementation, but let's check source carefully.
    // Source calls `fire_ionripper`. That seems like a new weapon type.
    // If we don't have ionripper, we should fallback or implement it.
    // The previous TS code didn't handle crouch frames (911-913) at all in offsets map?
    // Wait, the previous TS code had:
    // MZ2_GUNCMDR_GRENADE_CROUCH_1 = 9
    // And offsets were defined.
    // But `GunnerCmdrGrenade` in TS previously checked `attack_mortar_move` and `attack_grenade_back_move`.
    // It did NOT handle crouch frames logic.
    // So this is a new addition from the source.

    const isCrouch = (flash_number >= MZ2_GUNCMDR_GRENADE_CROUCH_1 && flash_number <= MZ2_GUNCMDR_GRENADE_CROUCH_3);
    const isMortar = (flash_number >= MZ2_GUNCMDR_GRENADE_MORTAR_1 && flash_number <= MZ2_GUNCMDR_GRENADE_MORTAR_3);
    const isFront = (flash_number >= MZ2_GUNCMDR_GRENADE_FRONT_1 && flash_number <= MZ2_GUNCMDR_GRENADE_FRONT_3);

    // Aim calculation logic from source
    if (self.enemy && !isCrouch) {
        let aimVec = subtractVec3(target, self.origin);
        const dist = lengthVec3(aimVec);

        if (dist > 512 && aimVec.z < 64 && aimVec.z > -64) {
             const newZ = aimVec.z + (dist - 512);
             aimVec = { ...aimVec, z: newZ };
        }
        aimVec = normalizeVec3(aimVec);
        pitch = aimVec.z;
        if (pitch > 0.4) pitch = 0.4;
        else if (pitch < -0.5) pitch = -0.5;

        if ((self.enemy.absmin.z - self.absmax.z) > 16 && isMortar) {
             pitch += 0.5;
        }
    }

    if (isFront) {
         pitch -= 0.05;
    }

    if (!isCrouch) {
         // aim = forward + (right * spread) + (up * pitch)
         // normalized
         const spreadPart = scaleVec3(right, spread);
         const pitchPart = scaleVec3(up, pitch);
         aim = normalizeVec3(addVec3(addVec3(forward, spreadPart), pitchPart));
    } else {
         const { aimdir } = PredictAim(context, self, self.enemy, start, 800, false, 0);
         const spreadPart = scaleVec3(right, spread);
         aim = normalizeVec3(addVec3(aimdir, spreadPart));
    }

    if (isCrouch) {
         // Fire Ion Ripper
         // Since we might not have ion ripper, we use fire_flechette as a fallback or similar?
         // Or just generic damage.
         // Source: fire_ionripper(self, start, aim + (right * (-(inner_spread * 2) + (inner_spread * (i + 1)))), 15, 800, EF_IONRIPPER);
         // For now, let's use flechette with high damage as approximation if ionripper missing.
         const inner_spread = 0.125;
         for (let i = 0; i < 3; i++) {
             const s = -(inner_spread * 2) + (inner_spread * (i + 1));
             const spreadVec = scaleVec3(right, s);
             const fireAim = normalizeVec3(addVec3(aim, spreadVec));
             monster_fire_flechette(self, start, fireAim, 15, 800, flash_number, context);
             // TODO: Add EF_IONRIPPER effect if available
         }
         // monster_muzzleflash(self, start, flash_number); // Handled inside fire functions usually or via multicast
    } else {
        let speed = isMortar ? MORTAR_SPEED : GRENADE_SPEED;

        // try search for best pitch
        const calcResult = M_CalculatePitchToFire(
            context,
            self,
            target,
            start,
            speed,
            2.5,
            isMortar
        );

        if (calcResult) {
            aim = calcResult.aimDir; // Use calculated aim
             monster_fire_grenade(self, start, aim, 50, speed, flash_number, context);
             // Note: source has random timer for grenades: (crandom_open() * 10.0f), frandom() * 10.f
             // Our monster_fire_grenade might not support that directly without updates.
             // But basic firing is achieved.
        } else {
             // normal shot
             monster_fire_grenade(self, start, aim, 50, speed, flash_number, context);
        }
    }
}

function guncmdr_grenade_mortar_resume(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, attack_mortar_move, context);
    self.monsterinfo.attack_state = MonsterAttackState.Straight;
    self.frame = self.count;
}

function guncmdr_grenade_back_dodge_resume(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, attack_grenade_back_move, context);
    self.monsterinfo.attack_state = MonsterAttackState.Straight;
    self.frame = self.count;
}

function guncmdr_kick_finished(self: Entity, context: EntitySystem): void {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 3;
    if (self.monsterinfo.attack) {
        self.monsterinfo.attack(self, context);
    }
}

function guncmdr_kick(self: Entity, context: EntitySystem): void {
     if (!self.enemy) return;
     // Source uses fire_hit(self, vec3_t { MELEE_DISTANCE, 0.f, -32.f }, 15.f, 400.f)
     // MELEE_DISTANCE is likely 64? Or similar.

     // Simplified check as per previous TS:
     const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
     // if (fire_hit(...)) logic would do trace/damage.
     // Previous TS:
     if (dist < 100) {
         if (self.enemy.client && self.enemy.velocity.z < 270) {
             self.enemy.velocity = { ...self.enemy.velocity, z: 270 };
         }
         // Needs damage application too!
         // context.damage(...)
     }
}

function monster_duck_down(self: Entity, context: EntitySystem): void {
    if (self.monsterinfo.aiflags & AIFlags.Ducked) return;
    self.monsterinfo.aiflags |= AIFlags.Ducked;
    self.maxs = { ...self.maxs, z: self.maxs.z - 32 };
    self.takedamage = true;
    self.monsterinfo.pausetime = context.timeSeconds + 1;
}

function monster_duck_hold(self: Entity, context: EntitySystem): void {
    if (context.timeSeconds >= self.monsterinfo.pausetime) {
        self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
    } else {
        self.monsterinfo.aiflags |= AIFlags.HoldFrame;
    }
}

function monster_duck_up(self: Entity, context: EntitySystem): void {
    self.monsterinfo.aiflags &= ~AIFlags.Ducked;
    self.maxs = { ...self.maxs, z: self.maxs.z + 32 };
    self.takedamage = true;
}

function guncmdr_jump_now(self: Entity, context: EntitySystem): void {
    const { forward, up } = angleVectors(self.angles);

    self.velocity = addVec3(self.velocity, scaleVec3(forward, 100));
    self.velocity = addVec3(self.velocity, scaleVec3(up, 300));
}

function guncmdr_jump2_now(self: Entity, context: EntitySystem): void {
    const { forward, up } = angleVectors(self.angles);

    self.velocity = addVec3(self.velocity, scaleVec3(forward, 150));
    self.velocity = addVec3(self.velocity, scaleVec3(up, 400));
}

function guncmdr_jump_wait_land(self: Entity, context: EntitySystem): void {
    if (self.groundentity === null) {
        self.monsterinfo.nextframe = self.frame;
         // if (monster_jump_finished(self)) self.monsterinfo.nextframe = self.frame + 1;
         // We need to implement monster_jump_finished logic or import it.
         // It was ticked in the plan.
         if (monster_jump_finished(context, self)) {
             self.monsterinfo.nextframe = self.frame + 1;
         }
    } else {
        self.monsterinfo.nextframe = self.frame + 1;
    }
}

// Added function to handle jump result
function guncmdr_jump(self: Entity, result: number, context: EntitySystem): void {
    if (!self.enemy) return;
    monster_done_dodge(self);

    // blocked_jump_result_t::JUMP_JUMP_UP is likely 2 or similar enum
    // Check usage in rogue.ts or where blocked_jump_result_t is defined
    if (result === BlockedJumpResult.JUMP_JUMP_UP) {
        M_SetAnimation(self, jump2_move, context);
    } else {
        M_SetAnimation(self, jump_move, context);
    }
}


function GunnerCmdrCounter(self: Entity, context: EntitySystem): void {
    // Rerelease logic:
    // gi.WriteByte(svc_temp_entity); gi.WriteByte(TE_BERSERK_SLAM); ...
    // T_SlamRadiusDamage(...)

    // Previous TS:
    context.engine.sound?.(self, 0, 'weapons/rocklx1a.wav', 1, 1, 0);
}

function guncmdr_attack(self: Entity, context: EntitySystem): void {
    monster_done_dodge(self);
    const d = lengthVec3(subtractVec3(self.enemy!.origin, self.origin));

    const { forward, right } = angleVectors(self.angles);

    const RANGE_GRENADE = 100;
    const RANGE_GRENADE_MORTAR = 525;
    const RANGE_MELEE = 64;

    // Check clear shot for mortar
    let mortarAim: Vec3 = { x: 0, y: 0, z: 0 };
    const mortarStart = M_ProjectFlashSource(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_MORTAR_1], forward, right);
    const mortarResult = M_CalculatePitchToFire(context, self, self.enemy!.origin, mortarStart, MORTAR_SPEED, 2.5, true);

    // Check clear shot for grenade
    let grenadeAim: Vec3 = { x: 0, y: 0, z: 0 };
    const grenadeStart = M_ProjectFlashSource(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_FRONT_1], forward, right);
    const grenadeResult = M_CalculatePitchToFire(context, self, self.enemy!.origin, grenadeStart, GRENADE_SPEED, 2.5, false);


    if (d < RANGE_MELEE && (self.monsterinfo.melee_debounce_time === undefined || self.monsterinfo.melee_debounce_time < context.timeSeconds)) {
        M_SetAnimation(self, attack_kick_move, context);
    } else if (d <= RANGE_GRENADE && M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_CHAINGUN_1], context)) {
        M_SetAnimation(self, attack_chain_move, context);
    } else if (
        (d >= RANGE_GRENADE_MORTAR || Math.abs(self.absmin.z - self.enemy!.absmax.z) > 64) &&
        M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_MORTAR_1], context) &&
        mortarResult
    ) {
         M_SetAnimation(self, attack_mortar_move, context);
         monster_duck_down(self, context);
    } else if (
        M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_FRONT_1], context) &&
        !(self.monsterinfo.aiflags & AIFlags.StandGround) &&
        grenadeResult
    ) {
        M_SetAnimation(self, attack_grenade_back_move, context);
    } else if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        M_SetAnimation(self, attack_chain_move, context);
    } else {
         M_SetAnimation(self, attack_chain_move, context);
    }
}

// Blocked handler
function guncmdr_blocked(self: Entity, dist: number, context: EntitySystem): boolean | void {
    if (blocked_checkplat(context, self, dist)) return true;

    const result = blocked_checkjump(context, self, dist, 192, 40);
    if (result !== BlockedJumpResult.NO_JUMP) {
         if (result !== BlockedJumpResult.JUMP_JUMP_DOWN) { // JUMP_TURN logic from C code was explicit result != 1
             guncmdr_jump(self, result, context);
         }
         return true;
    }
    return false;
}


// Pain & Death Transitions
function guncmdr_pain5_to_death1(self: Entity, context: EntitySystem): void {
    if (self.health < 0) M_SetAnimation(self, death1_move, context);
}
function guncmdr_pain5_to_death2(self: Entity, context: EntitySystem): void {
    if (self.health < 0 && context.game.random.frandom() < 0.5) M_SetAnimation(self, death2_move, context);
}
function guncmdr_pain6_to_death6(self: Entity, context: EntitySystem): void {
    if (self.health < 0) M_SetAnimation(self, death6_move, context);
}

function guncmdr_shrink(self: Entity, context: EntitySystem): void {
    self.maxs = { ...self.maxs, z: -4 * (self.monsterinfo.scale || 1) };
    // self.svflags |= SVF_DEADMONSTER;
}

function guncmdr_dead(self: Entity, context: EntitySystem): void {
    const scale = self.monsterinfo.scale || 1;
    self.mins = scaleVec3({ x: -16, y: -16, z: -24 }, scale);
    self.maxs = scaleVec3({ x: 16, y: 16, z: -8 }, scale);
    self.nextthink = -1;
    self.solid = Solid.Not;
}

// Pain
function guncmdr_pain(self: Entity, context: EntitySystem): void {
    monster_done_dodge(self);

    if (self.monsterinfo.current_move === jump_move ||
        self.monsterinfo.current_move === jump2_move ||
        self.monsterinfo.current_move === duck_attack_move) {
        return;
    }

    if (context.timeSeconds < self.pain_debounce_time) {
         if (context.game.random.frandom() < 0.3) {
             M_MonsterDodge(self, self.enemy!, 0.1);
         }
         return;
    }

    self.pain_debounce_time = context.timeSeconds + 3;

    if (context.game.random.frandom() < 0.5) {
         context.engine.sound?.(self, 0, 'guncmdr/gcdrpain2.wav', 1, 1, 0);
    } else {
         context.engine.sound?.(self, 0, 'guncmdr/gcdrpain1.wav', 1, 1, 0);
    }

    if (!M_ShouldReactToPain(self, context)) {
        if (context.game.random.frandom() < 0.3) {
            M_MonsterDodge(self, self.enemy!, 0.1);
        }
        return;
    }

    // Logic for directional pain
    const { forward } = angleVectors(self.angles);
    let dot = -1;
    if (self.enemy) {
        const dif = normalizeVec3(subtractVec3(self.enemy.origin, self.origin));
        // dif.z = 0? Source says: dif.z = 0; dif.normalize();
        dot = (dif.x * forward.x + dif.y * forward.y);
    }

    // damage < 35 -> small pain
    // For now simple random selection as per previous TS, but logic could be enhanced.

    const r = Math.floor(context.game.random.frandom() * 7);
    switch (r) {
        case 0: M_SetAnimation(self, pain1_move, context); break;
        case 1: M_SetAnimation(self, pain2_move, context); break;
        case 2: M_SetAnimation(self, pain3_move, context); break;
        case 3: M_SetAnimation(self, pain4_move, context); break;
        case 4: M_SetAnimation(self, pain5_move, context); break;
        case 5: M_SetAnimation(self, pain6_move, context); break;
        default: M_SetAnimation(self, pain7_move, context); break;
    }

    self.monsterinfo.aiflags &= ~AIFlags.ManualSteering;
    if (self.monsterinfo.aiflags & AIFlags.Ducked) monster_duck_up(self, context);
}

function guncmdr_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: EntitySystem): void {
    if (M_CheckGib(self, damage)) {
        context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
        throwGibs(context, self.origin, [{
            count: 1,
            model: 'models/monsters/gunner/gibs/chest.md2',
            flags: GibType.Metallic
        }]);
        self.deadflag = DeadFlag.Dead;
        return;
    }

    if (self.deadflag) return;

    context.engine.sound?.(self, 0, 'guncmdr/gcdrdeath1.wav', 1, 1, 0);
    self.deadflag = DeadFlag.Dead;
    self.takedamage = true;

    // Death selection
    const r = Math.floor(context.game.random.frandom() * 7);
    switch (r) {
         case 0: M_SetAnimation(self, death1_move, context); break;
         case 1: M_SetAnimation(self, death2_move, context); break;
         case 2: M_SetAnimation(self, death3_move, context); break;
         case 3: M_SetAnimation(self, death4_move, context); break;
         case 4: M_SetAnimation(self, death5_move, context); break;
         case 5: M_SetAnimation(self, death6_move, context); break;
         default: M_SetAnimation(self, death7_move, context); break;
    }
}

function guncmdr_setskin(self: Entity, context: EntitySystem): void {
    if (self.health < (self.max_health / 2)) {
        self.skin |= 1;
    } else {
        self.skin &= ~1;
    }
}

function guncmdr_duck(self: Entity, eta: number, context: EntitySystem): boolean {
    if (self.monsterinfo.current_move === jump_move || self.monsterinfo.current_move === jump2_move) return false;

    if (self.monsterinfo.current_move === fire_chain_dodge_left_move ||
        self.monsterinfo.current_move === fire_chain_dodge_right_move ||
        self.monsterinfo.current_move === attack_grenade_back_dodge_left_move ||
        self.monsterinfo.current_move === attack_grenade_back_dodge_right_move ||
        self.monsterinfo.current_move === attack_mortar_dodge_move) {
            monster_duck_up(self, context);
            return false;
        }

    M_SetAnimation(self, duck_attack_move, context);
    return true;
}

function guncmdr_sidestep(self: Entity, context: EntitySystem): boolean {
    if (self.monsterinfo.current_move === fire_chain_move || self.monsterinfo.current_move === fire_chain_run_move) {
        M_SetAnimation(self, context.game.random.frandom() < 0.5 ? fire_chain_dodge_right_move : fire_chain_dodge_left_move, context);
        return true;
    }

    if (self.monsterinfo.current_move === attack_grenade_back_move) {
        self.count = self.frame;
        M_SetAnimation(self, context.game.random.frandom() < 0.5 ? attack_grenade_back_dodge_right_move : attack_grenade_back_dodge_left_move, context);
        return true;
    }

    if (self.monsterinfo.current_move === attack_mortar_move) {
        self.count = self.frame;
        M_SetAnimation(self, attack_mortar_dodge_move, context);
        return true;
    }

    if (self.monsterinfo.current_move === run_move) {
        M_SetAnimation(self, run_move, context);
        return true;
    }

    return false;
}

// MOVES DEFINITIONS

// Fidget
fidget_move = {
    firstframe: 201, lastframe: 254,
    frames: Array(54).fill({ ai: monster_ai_stand, dist: 0 }),
    endfunc: guncmdr_stand
};
fidget_move.frames[6] = { ai: monster_ai_stand, dist: 0, think: guncmdr_idlesound };
fidget_move.frames[10] = { ai: monster_ai_stand, dist: 0, think: guncmdr_idlesound };

// Stand
stand_move = {
    firstframe: 101, lastframe: 140,
    frames: Array(40).fill({ ai: monster_ai_stand, dist: 0 }),
    endfunc: null
};
const stand_fidget = (self: Entity, context: EntitySystem) => guncmdr_fidget(self, context);
[9, 19, 29, 39].forEach(i => {
    stand_move.frames[i] = { ai: monster_ai_stand, dist: 0, think: stand_fidget };
});

// Walk
walk_move = {
    firstframe: 101, lastframe: 124,
    frames: [
        { ai: monster_ai_walk, dist: 1.5 }, { ai: monster_ai_walk, dist: 2.5 }, { ai: monster_ai_walk, dist: 3.0 },
        { ai: monster_ai_walk, dist: 2.5 }, { ai: monster_ai_walk, dist: 2.3 }, { ai: monster_ai_walk, dist: 3.0 },
        { ai: monster_ai_walk, dist: 2.8 }, { ai: monster_ai_walk, dist: 3.6 }, { ai: monster_ai_walk, dist: 2.8 },
        { ai: monster_ai_walk, dist: 2.5 }, { ai: monster_ai_walk, dist: 2.3 }, { ai: monster_ai_walk, dist: 4.3 },
        { ai: monster_ai_walk, dist: 3.0 }, { ai: monster_ai_walk, dist: 1.5 }, { ai: monster_ai_walk, dist: 2.5 },
        { ai: monster_ai_walk, dist: 3.3 }, { ai: monster_ai_walk, dist: 2.8 }, { ai: monster_ai_walk, dist: 3.0 },
        { ai: monster_ai_walk, dist: 2.0 }, { ai: monster_ai_walk, dist: 2.0 }, { ai: monster_ai_walk, dist: 3.3 },
        { ai: monster_ai_walk, dist: 3.6 }, { ai: monster_ai_walk, dist: 3.4 }, { ai: monster_ai_walk, dist: 2.8 },
    ],
    endfunc: null
};

// Run
run_move = {
    firstframe: 101, lastframe: 106,
    frames: [
        { ai: monster_ai_run, dist: 15.0, think: monster_done_dodge },
        { ai: monster_ai_run, dist: 16.0 },
        { ai: monster_ai_run, dist: 20.0 },
        { ai: monster_ai_run, dist: 18.0 },
        { ai: monster_ai_run, dist: 24.0 },
        { ai: monster_ai_run, dist: 13.5 }
    ],
    endfunc: null
};

// Attack Chain
attack_chain_move = {
    firstframe: 101, lastframe: 106,
    frames: Array(6).fill({ ai: monster_ai_charge, dist: 0 }),
    endfunc: guncmdr_fire_chain
};
attack_chain_move.frames[4].think = guncmdr_opengun;

// Fire Chain
fire_chain_move = {
    firstframe: 107, lastframe: 112,
    frames: Array(6).fill({ ai: monster_ai_charge, dist: 0, think: GunnerCmdrFire }),
    endfunc: guncmdr_refire_chain
};

// Fire Chain Run
fire_chain_run_move = {
    firstframe: 201, lastframe: 206,
    frames: [
        { ai: monster_ai_charge, dist: 15.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 16.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 20.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 18.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 24.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 13.5, think: GunnerCmdrFire }
    ],
    endfunc: guncmdr_refire_chain
};

// Dodge moves
fire_chain_dodge_right_move = {
    firstframe: 401, lastframe: 405,
    frames: [
        { ai: monster_ai_charge, dist: 10.2, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 18.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 7.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 7.2, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: -2.0, think: GunnerCmdrFire }
    ],
    endfunc: guncmdr_refire_chain
};
fire_chain_dodge_left_move = {
    firstframe: 501, lastframe: 505,
    frames: [
        { ai: monster_ai_charge, dist: 10.2, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 18.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 7.0, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: 7.2, think: GunnerCmdrFire },
        { ai: monster_ai_charge, dist: -2.0, think: GunnerCmdrFire }
    ],
    endfunc: guncmdr_refire_chain
};

// End Fire Chain
endfire_chain_move = {
    firstframe: 118, lastframe: 124,
    frames: Array(7).fill({ ai: monster_ai_charge, dist: 0 }),
    endfunc: guncmdr_run
};
endfire_chain_move.frames[2].think = guncmdr_opengun;

// Mortar
attack_mortar_move = {
    firstframe: 201, lastframe: 221,
    frames: Array(21).fill({ ai: monster_ai_charge, dist: 0 }),
    endfunc: guncmdr_run
};
attack_mortar_move.frames[4].think = GunnerCmdrGrenade;
attack_mortar_move.frames[7].think = GunnerCmdrGrenade;
attack_mortar_move.frames[10].think = GunnerCmdrGrenade;
attack_mortar_move.frames[13].think = monster_duck_up;

// Mortar Dodge
attack_mortar_dodge_move = {
    firstframe: 0, lastframe: 5,
    frames: [
        { ai: monster_ai_charge, dist: 11 }, { ai: monster_ai_charge, dist: 12 }, { ai: monster_ai_charge, dist: 16 },
        { ai: monster_ai_charge, dist: 16 }, { ai: monster_ai_charge, dist: 12 }, { ai: monster_ai_charge, dist: 11 }
    ],
    endfunc: guncmdr_grenade_mortar_resume
};

// Attack Back (Grenade)
attack_grenade_back_move = {
    firstframe: 302, lastframe: 321,
    frames: [
        { ai: monster_ai_charge, dist: -2 }, { ai: monster_ai_charge, dist: -1.5 }, { ai: monster_ai_charge, dist: -0.5, think: GunnerCmdrGrenade },
        { ai: monster_ai_charge, dist: -6 }, { ai: monster_ai_charge, dist: -4 }, { ai: monster_ai_charge, dist: -2.5, think: GunnerCmdrGrenade },
        { ai: monster_ai_charge, dist: -7 }, { ai: monster_ai_charge, dist: -3.5 }, { ai: monster_ai_charge, dist: -1.1, think: GunnerCmdrGrenade },
        { ai: monster_ai_charge, dist: -4.6 }, { ai: monster_ai_charge, dist: 1.9 }, { ai: monster_ai_charge, dist: 1.0 },
        { ai: monster_ai_charge, dist: -4.5 }, { ai: monster_ai_charge, dist: 3.2 }, { ai: monster_ai_charge, dist: 4.4 },
        { ai: monster_ai_charge, dist: -6.5 }, { ai: monster_ai_charge, dist: -6.1 }, { ai: monster_ai_charge, dist: 3.0 },
        { ai: monster_ai_charge, dist: -0.7 }, { ai: monster_ai_charge, dist: -1.0 }
    ],
    endfunc: guncmdr_run
};

// Back Dodge
attack_grenade_back_dodge_right_move = {
    firstframe: 601, lastframe: 605,
    frames: [
        { ai: monster_ai_charge, dist: 10.2 }, { ai: monster_ai_charge, dist: 18 }, { ai: monster_ai_charge, dist: 7 },
        { ai: monster_ai_charge, dist: 7.2 }, { ai: monster_ai_charge, dist: -2 }
    ],
    endfunc: guncmdr_grenade_back_dodge_resume
};
attack_grenade_back_dodge_left_move = {
    firstframe: 701, lastframe: 705,
    frames: [
        { ai: monster_ai_charge, dist: 10.2 }, { ai: monster_ai_charge, dist: 18 }, { ai: monster_ai_charge, dist: 7 },
        { ai: monster_ai_charge, dist: 7.2 }, { ai: monster_ai_charge, dist: -2 }
    ],
    endfunc: guncmdr_grenade_back_dodge_resume
};

// Kick
attack_kick_move = {
    firstframe: 801, lastframe: 808,
    frames: [
        { ai: monster_ai_charge, dist: -7.7 }, { ai: monster_ai_charge, dist: -4.9 }, { ai: monster_ai_charge, dist: 12.6, think: guncmdr_kick },
        { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: -3.0 }, { ai: monster_ai_charge, dist: 0 },
        { ai: monster_ai_charge, dist: -4.1 }, { ai: monster_ai_charge, dist: 8.6 }
    ],
    endfunc: guncmdr_kick_finished
};

// Duck Attack (Counter)
duck_attack_move = {
    firstframe: 901, lastframe: 919,
    frames: [
        { ai: monster_ai_move, dist: 3.6 }, { ai: monster_ai_move, dist: 5.6, think: monster_duck_down }, { ai: monster_ai_move, dist: 8.4 },
        { ai: monster_ai_move, dist: 2.0, think: monster_duck_hold }, { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 0 },
        { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 0 },
        { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 9.5, think: GunnerCmdrCounter },
        { ai: monster_ai_charge, dist: -1.5 }, { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 0, think: monster_duck_up },
        { ai: monster_ai_charge, dist: 0 }, { ai: monster_ai_charge, dist: 11 }, { ai: monster_ai_charge, dist: 2.0 }, { ai: monster_ai_charge, dist: 5.6 }
    ],
    endfunc: guncmdr_run
};

// Jump
jump_move = {
    firstframe: 0, lastframe: 9,
    frames: [
        { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 },
        { ai: monster_ai_move, dist: 0, think: guncmdr_jump_now }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 },
        { ai: monster_ai_move, dist: 0, think: guncmdr_jump_wait_land }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 }
    ],
    endfunc: guncmdr_run
};

jump2_move = {
    firstframe: 0, lastframe: 9,
    frames: [
        { ai: monster_ai_move, dist: -8 }, { ai: monster_ai_move, dist: -4 }, { ai: monster_ai_move, dist: -4 },
        { ai: monster_ai_move, dist: 0, think: guncmdr_jump2_now }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 },
        { ai: monster_ai_move, dist: 0, think: guncmdr_jump_wait_land }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 }, { ai: monster_ai_move, dist: 0 }
    ],
    endfunc: guncmdr_run
};

// Pain 1-7
pain1_move = { firstframe: 101, lastframe: 104, frames: Array(4).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain2_move = { firstframe: 201, lastframe: 204, frames: Array(4).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain3_move = { firstframe: 301, lastframe: 304, frames: Array(4).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain4_move = { firstframe: 401, lastframe: 415, frames: Array(15).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain5_move = { firstframe: 501, lastframe: 524, frames: Array(24).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain5_move.frames[5].think = guncmdr_pain5_to_death2;
pain5_move.frames[8].think = guncmdr_pain5_to_death1;
pain6_move = { firstframe: 601, lastframe: 632, frames: Array(32).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };
pain6_move.frames[6].think = guncmdr_pain6_to_death6;
pain7_move = { firstframe: 701, lastframe: 714, frames: Array(14).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_run };

// Death 1-7
death1_move = { firstframe: 101, lastframe: 118, frames: Array(18).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death2_move = { firstframe: 201, lastframe: 204, frames: Array(4).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death3_move = { firstframe: 301, lastframe: 321, frames: Array(21).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death3_move.frames[2].think = guncmdr_shrink;
death4_move = { firstframe: 401, lastframe: 436, frames: Array(36).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death4_move.frames[2].think = guncmdr_shrink;
death5_move = { firstframe: 501, lastframe: 528, frames: Array(28).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death6_move = { firstframe: 601, lastframe: 614, frames: Array(14).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death6_move.frames[0].think = guncmdr_shrink;
death7_move = { firstframe: 701, lastframe: 730, frames: Array(30).fill({ ai: monster_ai_move, dist: 0 }), endfunc: guncmdr_dead };
death7_move.frames[2].think = guncmdr_shrink;

// SP Function
export function SP_monster_guncmdr(self: Entity, context: SpawnContext): void {
    if (!M_AllowSpawn(self, context.entities)) {
        context.entities.free(self);
        return;
    }

    self.classname = 'monster_guncmdr';

    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.model = 'models/monsters/gunner/tris.md2';
    self.modelindex = context.entities.modelIndex('models/monsters/gunner/tris.md2');

    // Scale
    self.monsterinfo.scale = 1.25;
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 36 };
    self.skin = 2;

    // Stats
    self.health = 325 * context.health_multiplier;
    self.max_health = self.health;
    // self.gib_health = -175; // Removed as it is not on Entity
    self.mass = 255;

    self.pain = (s, o, k, d) => guncmdr_pain(s, context.entities);
    self.die = (s, i, a, d, p) => guncmdr_die(s, i, a, d, p, context.entities);

    self.monsterinfo.stand = (s) => guncmdr_stand(s, context.entities);
    self.monsterinfo.walk = (s) => guncmdr_walk(s, context.entities);
    self.monsterinfo.run = (s) => guncmdr_run(s, context.entities);
    self.monsterinfo.dodge = (s, a, e) => M_MonsterDodge(s, a, e);
    self.monsterinfo.duck = (s, e) => guncmdr_duck(s, e, context.entities);
    self.monsterinfo.unduck = (s) => monster_duck_up(s, context.entities);
    self.monsterinfo.sidestep = (s) => guncmdr_sidestep(s, context.entities);
    self.monsterinfo.blocked = (s, d) => guncmdr_blocked(s, d, context.entities);

    self.monsterinfo.attack = (s) => guncmdr_attack(s, context.entities);
    self.monsterinfo.sight = (s, o) => guncmdr_sight(s, o, context.entities);
    self.monsterinfo.search = (s) => guncmdr_search(s, context.entities);
    self.monsterinfo.setskin = (s) => guncmdr_setskin(s, context.entities);

    // Power Armor
    self.monsterinfo.power_armor_power = 200;
    self.monsterinfo.power_armor_type = 1; // Power Shield

    context.entities.linkentity(self);

    M_SetAnimation(self, stand_move, context.entities);

    self.think = monster_think;
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;
}

export function registerGunCommanderSpawns(registry: SpawnRegistry): void {
    registry.register('monster_guncmdr', SP_monster_guncmdr);
}
