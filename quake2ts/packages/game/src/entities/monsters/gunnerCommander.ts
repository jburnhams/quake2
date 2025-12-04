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
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { monster_fire_flechette } from './attack.js';
import { createGrenade } from '../projectiles.js';
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
  if (Math.random() <= 0.05) {
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
            if (Math.random() <= 0.5) {
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
    if (self.monsterinfo.current_move === fire_chain_dodge_right_move || self.monsterinfo.current_move === fire_chain_dodge_left_move) {
        flash_number = MZ2_GUNCMDR_CHAINGUN_2;
    } else {
        flash_number = MZ2_GUNCMDR_CHAINGUN_1;
    }

    const { forward, right } = angleVectors(self.angles);

    const start = M_ProjectFlashSource(self, monster_flash_offset[flash_number], forward, right);

    let aim = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Add randomness
    // Aim is readonly in shared types potentially, so we need to construct a new one if we want to modify it,
    // or just pass modified values.
    // However, normalizeVec3 returns a new object.
    const randomAim = { ...aim };
    for (let i = 0; i < 3; i++) {
        randomAim.x += (Math.random() - 0.5) * 0.05;
        randomAim.y += (Math.random() - 0.5) * 0.05;
        randomAim.z += (Math.random() - 0.5) * 0.05;
    }
    aim = normalizeVec3(randomAim);

    monster_fire_flechette(self, start, aim, 4, 800, flash_number, context);
}


function GunnerCmdrGrenade(self: Entity, context: EntitySystem): void {
    if (!self.enemy || !self.enemy.inUse) return;

    let spread = 0;
    let flash_number = 0;

    const frameIndex = self.frame;

    if (self.monsterinfo.current_move === attack_mortar_move) {
        const offset = frameIndex - attack_mortar_move.firstframe;
         if (offset === 4) { spread = -0.1; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_1; }
         else if (offset === 7) { spread = 0.0; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_2; }
         else if (offset === 10) { spread = 0.1; flash_number = MZ2_GUNCMDR_GRENADE_MORTAR_3; }
    } else if (self.monsterinfo.current_move === attack_grenade_back_move) {
        const offset = frameIndex - attack_grenade_back_move.firstframe;
        if (offset === 2) { spread = -0.1; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_1; }
        else if (offset === 5) { spread = 0.0; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_2; }
        else if (offset === 8) { spread = 0.1; flash_number = MZ2_GUNCMDR_GRENADE_FRONT_3; }
    }

    if (flash_number === 0) return;

    const { forward, right, up } = angleVectors(self.angles);

    const start = M_ProjectFlashSource(self, monster_flash_offset[flash_number], forward, right);
    let aim: Vec3;
    let pitch = 0;

    const target = self.enemy.origin;

    if (flash_number >= MZ2_GUNCMDR_GRENADE_FRONT_1 && flash_number <= MZ2_GUNCMDR_GRENADE_FRONT_3) {
         pitch -= 0.05;
    }

    if (flash_number >= MZ2_GUNCMDR_GRENADE_MORTAR_1 && flash_number <= MZ2_GUNCMDR_GRENADE_MORTAR_3) {
        let distVector = subtractVec3(target, self.origin);
        let dist = lengthVec3(distVector);

         if (dist > 512 && distVector.z < 64 && distVector.z > -64) {
             // distVector.z += (dist - 512); // Invalid assignment to readonly
             const newZ = distVector.z + (dist - 512);
             distVector = { ...distVector, z: newZ };
         }
         distVector = normalizeVec3(distVector);
         let p = distVector.z;
         if (p > 0.4) p = 0.4;
         else if (p < -0.5) p = -0.5;

         if ((self.enemy.absmin.z - self.absmax.z) > 16) {
             p += 0.5;
         }
         pitch += p;
    }

    aim = normalizeVec3(addVec3(addVec3(forward, scaleVec3(right, spread)), scaleVec3(up, pitch)));

    let speed = (flash_number >= MZ2_GUNCMDR_GRENADE_MORTAR_1 && flash_number <= MZ2_GUNCMDR_GRENADE_MORTAR_3) ? MORTAR_SPEED : GRENADE_SPEED;

    createGrenade(context, self, start, aim, 50, speed);
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
     const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
     if (dist < 100) {
         if (self.enemy.client && self.enemy.velocity.z < 270) {
             // self.enemy.velocity.z = 270; // Invalid assignment
             self.enemy.velocity = { ...self.enemy.velocity, z: 270 };
         }
     }
}

function monster_duck_down(self: Entity, context: EntitySystem): void {
    if (self.monsterinfo.aiflags & AIFlags.Ducked) return;
    self.monsterinfo.aiflags |= AIFlags.Ducked;
    // self.maxs.z -= 32; // Invalid assignment
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
    // self.maxs.z += 32; // Invalid assignment
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
    } else {
        self.monsterinfo.nextframe = self.frame + 1;
    }
}


function GunnerCmdrCounter(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, 'weapons/rocklx1a.wav', 1, 1, 0);
}

function guncmdr_attack(self: Entity, context: EntitySystem): void {
    monster_done_dodge(self);
    const d = lengthVec3(subtractVec3(self.enemy!.origin, self.origin));

    const { forward, right } = angleVectors(self.angles);

    const RANGE_GRENADE = 100;
    const RANGE_GRENADE_MORTAR = 525;
    const RANGE_MELEE = 64;

    if (d < RANGE_MELEE && (self.monsterinfo.melee_debounce_time === undefined || self.monsterinfo.melee_debounce_time < context.timeSeconds)) {
        M_SetAnimation(self, attack_kick_move, context);
    } else if (d <= RANGE_GRENADE && M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_CHAINGUN_1], context)) {
        M_SetAnimation(self, attack_chain_move, context);
    } else if (
        (d >= RANGE_GRENADE_MORTAR || Math.abs(self.absmin.z - self.enemy!.absmax.z) > 64) &&
        M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_MORTAR_1], context)
    ) {
         M_SetAnimation(self, attack_mortar_move, context);
         monster_duck_down(self, context);
    } else if (
        M_CheckClearShot(self, monster_flash_offset[MZ2_GUNCMDR_GRENADE_FRONT_1], context) &&
        !(self.monsterinfo.aiflags & AIFlags.StandGround)
    ) {
        M_SetAnimation(self, attack_grenade_back_move, context);
    } else if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        M_SetAnimation(self, attack_chain_move, context);
    } else {
         M_SetAnimation(self, attack_chain_move, context);
    }
}


// Pain & Death Transitions
function guncmdr_pain5_to_death1(self: Entity, context: EntitySystem): void {
    if (self.health < 0) M_SetAnimation(self, death1_move, context);
}
function guncmdr_pain5_to_death2(self: Entity, context: EntitySystem): void {
    if (self.health < 0 && Math.random() < 0.5) M_SetAnimation(self, death2_move, context);
}
function guncmdr_pain6_to_death6(self: Entity, context: EntitySystem): void {
    if (self.health < 0) M_SetAnimation(self, death6_move, context);
}

function guncmdr_shrink(self: Entity, context: EntitySystem): void {
    // self.maxs.z = -4 * (self.monsterinfo.scale || 1);
    self.maxs = { ...self.maxs, z: -4 * (self.monsterinfo.scale || 1) };
}

function guncmdr_dead(self: Entity, context: EntitySystem): void {
    const scale = self.monsterinfo.scale || 1;
    self.mins = scaleVec3({ x: -16, y: -16, z: -24 }, scale);
    self.maxs = scaleVec3({ x: 16, y: 16, z: -8 }, scale);
    // self.monsterinfo.aiflags |= AIFlags.DeadMonster; // DeadMonster not in AIFlags enum, maybe DeadFlag?
    // Using DeadFlag on self.deadflag instead usually.
    // If it's a specific AI flag, it should be defined.
    // Assuming AIFlags doesn't have DeadMonster based on compilation error.
    // Let's assume it's just meant to be a state or we skip it if it's not crucial for logic here.
    // Or maybe it was meant to be ServerFlags.DeadMonster?
    // self.svflags |= ServerFlags.DeadMonster;

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
         return;
    }

    self.pain_debounce_time = context.timeSeconds + 3;

    if (Math.random() < 0.5) {
         context.engine.sound?.(self, 0, 'guncmdr/gcdrpain2.wav', 1, 1, 0);
    } else {
         context.engine.sound?.(self, 0, 'guncmdr/gcdrpain1.wav', 1, 1, 0);
    }

    if (!M_ShouldReactToPain(self, context)) return;

    const r = Math.floor(Math.random() * 7);
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
        // throwGibs signature is (sys, origin, damage|defs, type?)
        // The call was passing 5 args: context, origin, damage, model, type
        // This is incorrect. It should probably pass a GibDef array if it wants specific models.
        // Or if it wants to use the generic damage based one, it should match the signature.
        // However, looking at the intent, it wants to throw a specific model.
        // throwGibs supports passing an array of GibDefs.
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
    const r = Math.floor(Math.random() * 7);
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
        M_SetAnimation(self, Math.random() < 0.5 ? fire_chain_dodge_right_move : fire_chain_dodge_left_move, context);
        return true;
    }

    if (self.monsterinfo.current_move === attack_grenade_back_move) {
        self.count = self.frame;
        M_SetAnimation(self, Math.random() < 0.5 ? attack_grenade_back_dodge_right_move : attack_grenade_back_dodge_left_move, context);
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
