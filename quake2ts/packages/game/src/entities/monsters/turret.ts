import { angleVectors, normalizeVec3, subtractVec3, Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import {
    ai_charge,
    ai_run,
    ai_stand,
    monster_think,
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
import { monster_fire_blaster } from './attack.js';
import { throwGibs } from '../gibs.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
    ai_stand(self, MONSTER_TICK);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
    // Turrets don't move, but they track enemies (rotate)
    ai_run(self, dist, MONSTER_TICK, context);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
    ai_charge(self, dist, MONSTER_TICK, context);
}

// Forward declarations
let stand_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function turret_stand(self: Entity): void {
    self.monsterinfo.current_move = stand_move;
}

function turret_run(self: Entity): void {
    if (self.enemy && self.enemy.health > 0) {
        self.monsterinfo.current_move = run_move;
    } else {
        self.monsterinfo.current_move = stand_move;
    }
}

function turret_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Turret firing logic
    const forward = angleVectors(self.angles).forward;
    const start = {
        x: self.origin.x + forward.x * 8,
        y: self.origin.y + forward.y * 8,
        z: self.origin.z + self.viewheight,
    };

    // Aim at enemy
    const enemyDir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    context.engine.sound?.(self, 0, 'turret/fire.wav', 1, 1, 0);

    // Fire blaster
    monster_fire_blaster(self, start, enemyDir, 2, 1000, 1, 0, context);
}

function turret_attack(self: Entity): void {
    self.monsterinfo.current_move = attack_move;
}

function turret_pain(self: Entity): void {
    self.monsterinfo.current_move = pain_move;
}

function turret_die(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'turret/death.wav', 1, 1, 0);
    self.monsterinfo.current_move = death_move;
}

// Frames
// Note: Frame indices are relative assumptions as actual MD2 is unavailable.
// We align with typical Quake 2 turret logic (8 attack frames, fire on one).

const stand_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
    ai: monster_ai_stand,
    dist: 0,
}));

stand_move = {
    firstframe: 0,
    lastframe: 0,
    frames: stand_frames,
    endfunc: turret_stand,
};

const run_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
    ai: monster_ai_run,
    dist: 0,
}));

run_move = {
    firstframe: 0, // In Q2 turret usually just rotates in idle frame?
    lastframe: 0,
    frames: run_frames,
    endfunc: turret_run,
};

// Attack: 8 frames, fire on 5th (index 4)
const attack_frames: MonsterFrame[] = Array.from({ length: 8 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 4) ? turret_fire : undefined,
}));

attack_move = {
    firstframe: 1,
    lastframe: 8,
    frames: attack_frames,
    endfunc: turret_run,
};

const pain_frames: MonsterFrame[] = Array.from({ length: 2 }, () => ({
    ai: monster_ai_run,
    dist: 0,
}));

pain_move = {
    firstframe: 9,
    lastframe: 10,
    frames: pain_frames,
    endfunc: turret_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
    ai: monster_ai_run, // No movement
    dist: 0,
}));

function turret_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;
}

death_move = {
    firstframe: 11,
    lastframe: 14,
    frames: death_frames,
    endfunc: turret_dead,
};

export function SP_monster_turret(self: Entity, context: SpawnContext): void {
    self.model = 'models/monsters/turret/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.health = 100;
    self.max_health = 100;
    self.mass = 200;
    self.takedamage = true;
    self.viewheight = 24;

    self.pain = (self, other, kick, damage) => {
        if (self.health <= 0) return;

        // Debounce pain
        if (context.entities.timeSeconds < self.pain_debounce_time) return;
        self.pain_debounce_time = context.entities.timeSeconds + 3;

        context.entities.sound?.(self, 0, 'turret/pain.wav', 1, 1, 0);

        // Play pain animation
        self.monsterinfo.current_move = pain_move;
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        self.takedamage = false; // Stop taking damage while dying unless gibbed

        if (self.health <= -40) {
            self.deadflag = DeadFlag.Dead;
            self.solid = Solid.Not;
            context.entities.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
            throwGibs(context.entities, self.origin, damage);
            context.entities.free(self);
            return;
        }

        self.deadflag = DeadFlag.Dying;
        self.solid = Solid.Not;
        turret_die(self, context.entities);
    };

    self.monsterinfo.stand = turret_stand;
    self.monsterinfo.walk = turret_run;
    self.monsterinfo.run = turret_run;
    self.monsterinfo.attack = turret_attack;
    self.monsterinfo.sight = (self, other) => {
        context.entities.sound?.(self, 0, 'turret/sight.wav', 1, 1, 0);
    }

    self.think = monster_think;

    turret_stand(self);
    self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerTurretSpawns(registry: SpawnRegistry): void {
    registry.register('monster_turret', SP_monster_turret);
}
