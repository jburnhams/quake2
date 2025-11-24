import {
  angleVectors,
  addVec3,
  scaleVec3,
  subtractVec3,
  normalizeVec3,
  vectorToAngles,
  lengthVec3,
  Vec3,
  ZERO_VEC3,
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
import { DamageFlags } from '../../combat/damageFlags.js';
import { M_CheckBottom } from '../../ai/movement.js';

const MONSTER_TICK = 0.1;

// Helper to access deterministic RNG or Math.random
const random = () => Math.random();

// Wrappers for AI functions
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


// Forward declarations
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;
let jump_move: MonsterMove;


function mutant_step(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function mutant_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function mutant_run(self: Entity): void {
  self.monsterinfo.current_move = run_move;
}

function mutant_swing(self: Entity, damage: number, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'mutant/mutatck1.wav', 1, 1, 0);
  if (!self.enemy) return;

  const aim = subtractVec3(self.enemy.origin, self.origin);
  const dist = lengthVec3(aim);

  if (dist > 100) return; // Miss

  const dir = normalizeVec3(aim);
  T_Damage(
      self.enemy as unknown as Damageable,
      self as unknown as Damageable,
      self as unknown as Damageable,
      dir,
      self.enemy.origin,
      ZERO_VEC3,
      damage,
      0,
      0,
      DamageMod.UNKNOWN
  );
}

function mutant_hit_right(self: Entity, context: EntitySystem): void {
    mutant_swing(self, 30, context);
}

function mutant_hit_left(self: Entity, context: EntitySystem): void {
    mutant_swing(self, 30, context);
}

function mutant_check_ground(self: Entity, context: EntitySystem): void {
    if (self.flags & (1 << 0)) { // FL_ONGROUND? No, EntityFlags.Fly is bit 0. Wait, check EntityFlags.
        // In C code: if (self->flags & FL_ONGROUND)
        // Here check groundentity
        if (self.groundentity) {
            self.movetype = MoveType.Step;
            self.monsterinfo.current_move = run_move;
            // self.monsterinfo.nextframe = run_move.firstframe; // Wait, run_move sets this?
        }
    }
    // Actually, we need to check if we landed.
    // If using MoveType.Toss, the engine physics should set groundentity when it lands.
    if (self.groundentity) {
        self.movetype = MoveType.Step;
        self.monsterinfo.current_move = run_move;
    }
}

function mutant_jump_touch(self: Entity, other: Entity | null, plane?: any, surf?: any): void {
    if (self.health <= 0) return;

    if (other && other.takedamage) {
        if (self.velocity.z > 0) {
            self.velocity = { ...self.velocity, z: 0 };
        }

        T_Damage(
            other as unknown as Damageable,
            self as unknown as Damageable,
            self as unknown as Damageable,
            normalizeVec3(self.velocity),
            self.origin,
            ZERO_VEC3,
            50,
            0,
            0,
            DamageMod.UNKNOWN
        );
    }

    if (!other || (!other.takedamage && other.solid !== Solid.Not)) { // World or solid object
        self.touch = undefined;
    }
}

function mutant_jump_takeoff(self: Entity, context: EntitySystem): void {
    const forward = angleVectors(self.angles).forward;

    self.movetype = MoveType.Toss;
    self.touch = mutant_jump_touch;
    self.velocity = addVec3(scaleVec3(forward, 300), { x: 0, y: 0, z: 300 }); // Reduced from 600/250 to ensure control? No, match C.
    // C code: Velocity 600 forward, 250 up.
    self.velocity = addVec3(scaleVec3(forward, 600), { x: 0, y: 0, z: 250 });

    self.groundentity = null;

    context.engine.sound?.(self, 0, 'mutant/mutatck2.wav', 1, 1, 0);
}

function mutant_check_attack(self: Entity): boolean {
    if (self.enemy && self.enemy.health > 0) {
        // If close and in front, melee
        // If mid range, jump?

        const diff = subtractVec3(self.enemy.origin, self.origin);
        const dist = lengthVec3(diff);

        if (dist < 128 && random() < 0.5) {
             self.monsterinfo.current_move = attack_move;
             return true;
        }

        if (dist >= 128 && dist < 512 && random() < 0.3) {
            self.monsterinfo.current_move = jump_move;
            return true;
        }
    }
    return false;
}

function mutant_pain_func(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.health < (self.max_health / 2)) {
        self.skin = 1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;
    self.pain_finished_time = self.timestamp + 3;

    if (random() < 0.5) {
         context.engine.sound?.(self, 0, 'mutant/mutpain1.wav', 1, 1, 0);
         self.monsterinfo.current_move = pain1_move;
    } else if (random() < 0.5) {
         context.engine.sound?.(self, 0, 'mutant/mutpain2.wav', 1, 1, 0);
         self.monsterinfo.current_move = pain2_move;
    } else {
         context.engine.sound?.(self, 0, 'mutant/mutpain3.wav', 1, 1, 0);
         self.monsterinfo.current_move = pain3_move;
    }
}

function mutant_die(self: Entity): void {
    self.monsterinfo.current_move = death_move;
}

function mutant_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
}


// ----------------------------------------------------------------------
// FRAMES & MOVES
// ----------------------------------------------------------------------

const stand_frames: MonsterFrame[] = [
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 }
];

stand_move = {
    firstframe: 0,
    lastframe: 50,
    frames: stand_frames,
    endfunc: mutant_stand
};

const walk_frames: MonsterFrame[] = [
    { ai: monster_ai_walk, dist: 3 },
    { ai: monster_ai_walk, dist: 1 },
    { ai: monster_ai_walk, dist: 5 },
    { ai: monster_ai_walk, dist: 10 },
    { ai: monster_ai_walk, dist: 13 },
    { ai: monster_ai_walk, dist: 12 },
    { ai: monster_ai_walk, dist: 0 },
    { ai: monster_ai_walk, dist: 0 },
    { ai: monster_ai_walk, dist: 5 },
    { ai: monster_ai_walk, dist: 6 },
    { ai: monster_ai_walk, dist: 16 },
    { ai: monster_ai_walk, dist: 15 },
    { ai: monster_ai_walk, dist: 6 }
];

walk_move = {
    firstframe: 51,
    lastframe: 63,
    frames: walk_frames,
    endfunc: mutant_step
};

const run_frames: MonsterFrame[] = [
    { ai: monster_ai_run, dist: 20 },
    { ai: monster_ai_run, dist: 15 },
    { ai: monster_ai_run, dist: 35 },
    { ai: monster_ai_run, dist: 20 },
    { ai: monster_ai_run, dist: 10 },
    { ai: monster_ai_run, dist: 20 }
];

run_move = {
    firstframe: 64,
    lastframe: 69,
    frames: run_frames,
    endfunc: mutant_run
};

const attack_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: mutant_hit_left },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: mutant_hit_right },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: mutant_hit_left },
    { ai: monster_ai_charge, dist: 0 }
];

attack_move = {
    firstframe: 70,
    lastframe: 77,
    frames: attack_frames,
    endfunc: mutant_run
};

const jump_frames: MonsterFrame[] = [
    { ai: monster_ai_face, dist: 0 },
    { ai: monster_ai_face, dist: 0 },
    { ai: monster_ai_face, dist: 0, think: mutant_jump_takeoff },
    { ai: monster_ai_move, dist: 0, think: mutant_check_ground },
    { ai: monster_ai_move, dist: 0, think: mutant_check_ground },
    { ai: monster_ai_move, dist: 0, think: mutant_check_ground },
    { ai: monster_ai_move, dist: 0, think: mutant_check_ground },
    { ai: monster_ai_move, dist: 0, think: mutant_check_ground }
];

jump_move = {
    firstframe: 93,
    lastframe: 100,
    frames: jump_frames,
    endfunc: mutant_run // Should loop until grounded? The C code uses a loop for the jump frames.
};
// Override to loop jump frames
jump_move.frames[3].ai = (self: Entity, dist: number, context: any) => {
    mutant_check_ground(self, context);
    if (self.groundentity) return; // Landed
    // Not landed, decrement frame to loop
    // But frame logic increments. So we need to handle loop manually or allow frame controller to do it.
    // In standard Quake2 AI, looping involves setting nextframe back.
    if (self.frame === 99) { // Near end of loop
        if (!self.groundentity) {
             self.monsterinfo.nextframe = 96; // Loop back to air frames
        }
    }
};


const pain1_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 4 },
    { ai: monster_ai_move, dist: -3 },
    { ai: monster_ai_move, dist: -8 },
    { ai: monster_ai_move, dist: 2 },
    { ai: monster_ai_move, dist: 5 }
];

pain1_move = {
    firstframe: 78,
    lastframe: 82,
    frames: pain1_frames,
    endfunc: mutant_run
};

const pain2_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: -24 },
    { ai: monster_ai_move, dist: 11 },
    { ai: monster_ai_move, dist: 5 },
    { ai: monster_ai_move, dist: -2 }
];

pain2_move = {
    firstframe: 83,
    lastframe: 86,
    frames: pain2_frames,
    endfunc: mutant_run
};

const pain3_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 11 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: -2 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 }
];

pain3_move = {
    firstframe: 87,
    lastframe: 92,
    frames: pain3_frames,
    endfunc: mutant_run
};

const death_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 }
];

death_move = {
    firstframe: 101,
    lastframe: 109,
    frames: death_frames,
    endfunc: mutant_dead
};

export function SP_monster_mutant(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_mutant';
  self.model = 'models/monsters/mutant/tris.md2';
  self.mins = { x: -32, y: -32, z: -24 };
  self.maxs = { x: 32, y: 32, z: 48 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 300;
  self.max_health = 300;
  self.mass = 300;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => {
    mutant_pain_func(ent, other, kick, dmg, context.entities);
  };

  self.die = (ent, inflictor, attacker, damage, point) => {
    ent.deadflag = DeadFlag.Dead;
    ent.solid = Solid.Not;

    if (ent.health < -40) {
        throwGibs(context.entities, ent.origin, damage);
        context.entities.free(ent);
        return;
    }

    context.entities.engine.sound?.(ent, 0, 'mutant/mutdeth1.wav', 1, 1, 0);
    ent.takedamage = true;
    mutant_die(ent);
  };

  self.monsterinfo.stand = mutant_stand;
  self.monsterinfo.walk = mutant_step;
  self.monsterinfo.run = mutant_run;
  self.monsterinfo.checkattack = mutant_check_attack;
  self.monsterinfo.attack = (ent) => {
      ent.monsterinfo.current_move = attack_move;
  };
  self.monsterinfo.sight = (ent, other) => {
    context.entities.engine.sound?.(ent, 0, 'mutant/mutsght1.wav', 1, 1, 0);
  };
  self.monsterinfo.idle = mutant_stand;

  self.think = monster_think;

  mutant_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMutantSpawns(registry: SpawnRegistry): void {
  registry.register('monster_mutant', SP_monster_mutant);
}
