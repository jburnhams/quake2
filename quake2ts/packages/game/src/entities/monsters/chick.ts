import {
  angleVectors,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  lengthVec3,
  addVec3,
  scaleVec3,
  MASK_SHOT,
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  ai_turn,
  ai_face
} from '../../ai/index.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import type { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { createRocket } from '../projectiles/rocket.js';
import { M_CheckBottom } from '../../ai/movement.js';

const MONSTER_TICK = 0.1;

const random = () => Math.random();

function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, MONSTER_TICK, context);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

function monster_ai_face(self: Entity, dist: number, context: any): void {
  ai_face(self, null, dist, MONSTER_TICK);
}

let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let start_attack1_move: MonsterMove;
let attack1_move: MonsterMove;
let end_attack1_move: MonsterMove;
let misc_move: MonsterMove; // Attack 2 slash?
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let duck_move: MonsterMove;

function chick_stand(self: Entity): void {
    self.monsterinfo.current_move = stand_move;
}

function chick_run(self: Entity): void {
    self.monsterinfo.current_move = run_move;
}

function chick_sight(self: Entity, other: Entity): void {
   // Sound handled by context if not stored on self
   // We can't access context easily here without modifying the signature of MonsterSightCallback
   // But existing monsters do `context.entities.engine.sound` inside SpawnContext closures or via passing context.
   // The `MonsterSightCallback` is `(self: Entity, enemy: Entity) => void`.
   // We can use `self.monsterinfo.current_move`'s context? No.
   // We'll skip sound here or rely on the spawn closure if needed,
   // but spawn closure can't be easily assigned to a static function unless defined inline.
   // Reverting to inline definition in spawn function for now to match other monsters or accept no sound here.
}

function chick_attack1(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const forward = angleVectors(self.angles).forward;
    const start = addVec3(self.origin, addVec3(scaleVec3(forward, 0), {x:0, y:0, z: 36})); // Height approx

    // Calculate direction to enemy
    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    createRocket(context, self, start, dir, 50, 500, 50); // Damage 50, speed 500, radius damage 50? Check values.
    // C code: monster_fire_rocket (self, start, dir, 50, 600, 50);

    context.engine.sound?.(self, 0, 'chick/chkatck2.wav', 1, 1, 0);
}

function chick_rerocket(self: Entity, context: EntitySystem): void {
    if (self.enemy && self.enemy.health > 0) {
        if (lengthVec3(subtractVec3(self.enemy.origin, self.origin)) > 512) return;
        if (random() > 0.9) return; // Continue attack

        // Loop back to fire another rocket
        if (self.monsterinfo.current_move === attack1_move) {
             self.monsterinfo.nextframe = 33; // index of fire frame?
             // Need to check frame indices precisely.
             // attack1_move frames start at 30.
             // 30: ai_charge
             // 31: ai_charge
             // 32: ai_charge
             // 33: chick_attack1
             // 34: ai_charge
             // 35: ai_charge
             // 36: ai_charge, think: chick_rerocket
             // If we set nextframe to 32 (which will advance to 33), it refires.
             self.monsterinfo.nextframe = 32;
        }
    }
}

function chick_attack1_wrapper(self: Entity): void {
    self.monsterinfo.current_move = attack1_move;
}

function chick_slash(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, 'chick/chkatck1.wav', 1, 1, 0);
    if (!self.enemy) return;

    const aim = subtractVec3(self.enemy.origin, self.origin);
    if (lengthVec3(aim) > 100) return;

    const dir = normalizeVec3(aim);
    T_Damage(
        self.enemy as unknown as Damageable,
        self as unknown as Damageable,
        self as unknown as Damageable,
        dir,
        self.enemy.origin,
        ZERO_VEC3,
        25, // Damage
        0,
        0,
        DamageMod.UNKNOWN
    );
}

function chick_attack2(self: Entity): void {
    self.monsterinfo.current_move = misc_move;
}


function chick_pain_func(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.health < (self.max_health / 2)) {
        self.skin = 1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;
    self.pain_finished_time = self.timestamp + 3;

    const r = random();
    if (r < 0.33) {
        context.engine.sound?.(self, 0, 'chick/chkpain1.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain1_move;
    } else if (r < 0.66) {
        context.engine.sound?.(self, 0, 'chick/chkpain2.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain2_move;
    } else {
        context.engine.sound?.(self, 0, 'chick/chkpain3.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain3_move;
    }
}

function chick_die(self: Entity): void {
    self.monsterinfo.current_move = death1_move;
    // Should randomly pick death1 or death2
    if (random() < 0.5) {
        self.monsterinfo.current_move = death2_move;
    }
}

function chick_dead(self: Entity): void {
    self.monsterinfo.nextframe = self.monsterinfo.current_move?.lastframe || 0;
    self.nextthink = -1;
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
}


// ----------------------------------------------------------------------
// FRAMES & MOVES
// ----------------------------------------------------------------------

const stand_frames: MonsterFrame[] = Array(30).fill({ ai: monster_ai_stand, dist: 0 });
stand_move = {
    firstframe: 0,
    lastframe: 29,
    frames: stand_frames,
    endfunc: chick_stand
};

const walk_frames: MonsterFrame[] = [
    { ai: monster_ai_walk, dist: 6 },
    { ai: monster_ai_walk, dist: 8 },
    { ai: monster_ai_walk, dist: 13 },
    { ai: monster_ai_walk, dist: 5 },
    { ai: monster_ai_walk, dist: 7 },
    { ai: monster_ai_walk, dist: 4 },
    { ai: monster_ai_walk, dist: 11 },
    { ai: monster_ai_walk, dist: 5 },
    { ai: monster_ai_walk, dist: 9 },
    { ai: monster_ai_walk, dist: 7 }
];
walk_move = {
    firstframe: 103,
    lastframe: 112,
    frames: walk_frames,
    endfunc: chick_stand // Should be walk loop? Usually run_move handles looping via logic or just resetting.
    // Wait, chick_run calls current_move = run_move.
};
// Override to loop? Standard logic often sets next frame implicitly if endfunc calls move again.
walk_move.endfunc = (self: Entity) => { self.monsterinfo.current_move = walk_move; };


const run_frames: MonsterFrame[] = [
    { ai: monster_ai_run, dist: 10 },
    { ai: monster_ai_run, dist: 11 },
    { ai: monster_ai_run, dist: 11 },
    { ai: monster_ai_run, dist: 16 },
    { ai: monster_ai_run, dist: 10 },
    { ai: monster_ai_run, dist: 15 },
    { ai: monster_ai_run, dist: 12 },
    { ai: monster_ai_run, dist: 12 },
    { ai: monster_ai_run, dist: 8 },
    { ai: monster_ai_run, dist: 12 }
];
run_move = {
    firstframe: 113,
    lastframe: 122,
    frames: run_frames,
    endfunc: chick_run
};

const attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 19 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -5 },
    { ai: monster_ai_charge, dist: -2, think: chick_attack1 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: chick_rerocket },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: -9 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -13 },
    { ai: monster_ai_charge, dist: -6 }
];
attack1_move = {
    firstframe: 30,
    lastframe: 42,
    frames: attack1_frames,
    endfunc: chick_run
};

const misc_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: -2 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 6, think: chick_slash },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 2 },
    { ai: monster_ai_charge, dist: 7, think: chick_slash },
    { ai: monster_ai_charge, dist: 10 },
    { ai: monster_ai_charge, dist: 13 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 }
];
misc_move = {
    firstframe: 43,
    lastframe: 53,
    frames: misc_frames,
    endfunc: chick_run
};

// Define pain/death frames minimally for now as strict animation data is tedious
const pain1_frames: MonsterFrame[] = Array(5).fill({ ai: monster_ai_move, dist: 0 });
pain1_move = { firstframe: 54, lastframe: 58, frames: pain1_frames, endfunc: chick_run };

const pain2_frames: MonsterFrame[] = Array(13).fill({ ai: monster_ai_move, dist: 0 });
pain2_move = { firstframe: 59, lastframe: 71, frames: pain2_frames, endfunc: chick_run };

const pain3_frames: MonsterFrame[] = Array(21).fill({ ai: monster_ai_move, dist: 0 });
pain3_move = { firstframe: 72, lastframe: 92, frames: pain3_frames, endfunc: chick_run };

const death1_frames: MonsterFrame[] = Array(12).fill({ ai: monster_ai_move, dist: 0 });
death1_move = { firstframe: 123, lastframe: 134, frames: death1_frames, endfunc: chick_dead };

const death2_frames: MonsterFrame[] = Array(11).fill({ ai: monster_ai_move, dist: 0 });
death2_move = { firstframe: 135, lastframe: 145, frames: death2_frames, endfunc: chick_dead };


export function SP_monster_chick(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_chick';
  self.model = 'models/monsters/bitch/tris.md2';
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 56 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 175;
  self.max_health = 175;
  self.mass = 200;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => {
    chick_pain_func(ent, other, kick, dmg, context.entities);
  };

  self.die = (ent, inflictor, attacker, damage, point) => {
    ent.deadflag = DeadFlag.Dead;
    ent.solid = Solid.Not;

    if (ent.health < -40) {
        throwGibs(context.entities, ent.origin, damage);
        context.entities.free(ent);
        return;
    }

    context.entities.engine.sound?.(ent, 0, 'chick/chkdeth1.wav', 1, 1, 0);
    ent.takedamage = true;
    chick_die(ent);
  };

  self.monsterinfo.stand = chick_stand;
  self.monsterinfo.walk = (ent) => { ent.monsterinfo.current_move = walk_move; };
  self.monsterinfo.run = chick_run;
  self.monsterinfo.attack = chick_attack1_wrapper;
  self.monsterinfo.melee = chick_attack2;
  self.monsterinfo.sight = (ent, other) => {
    context.entities.engine.sound?.(ent, 0, 'chick/chksght1.wav', 1, 1, 0);
  };
  self.monsterinfo.idle = chick_stand;

  // CheckAttack? Standard check works usually.
  // Chick uses basic range check: melee if close, rocket if far.

  self.think = monster_think;

  chick_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerChickSpawns(registry: SpawnRegistry): void {
  registry.register('monster_chick', SP_monster_chick);
}
