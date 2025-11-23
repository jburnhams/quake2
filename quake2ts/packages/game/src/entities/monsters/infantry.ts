import { angleVectors, normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
import {
    ai_charge,
    ai_move,
    ai_run,
    ai_stand,
    ai_walk,
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
import { monster_fire_bullet } from './attack.js';
import { throwGibs } from '../gibs.js';
import type { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
    ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
    ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
    ai_run(self, dist, MONSTER_TICK);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
    ai_charge(self, dist, MONSTER_TICK);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
    ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;
let duck_move: MonsterMove;

function infantry_stand(self: Entity): void {
    self.monsterinfo.current_move = stand_move;
}

function infantry_walk(self: Entity): void {
    self.monsterinfo.current_move = walk_move;
}

function infantry_run(self: Entity): void {
    if (self.enemy && self.enemy.health > 0) {
        self.monsterinfo.current_move = run_move;
    } else {
        self.monsterinfo.current_move = stand_move;
    }
}

function infantry_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };

    // Calculate aim direction towards enemy eye level
    const target = {
        x: self.enemy.origin.x,
        y: self.enemy.origin.y,
        z: self.enemy.origin.z + (self.enemy.viewheight || 0),
    };

    const forward = normalizeVec3(subtractVec3(target, start));
    const damage = 5;
    const kick = 2;
    // Infantry has decent aim
    const hspread = 0.05;
    const vspread = 0.05;

    monster_fire_bullet(self, start, forward, damage, kick, hspread, vspread, 0, context, DamageMod.MACHINEGUN);
}

function infantry_attack(self: Entity): void {
    self.monsterinfo.current_move = attack_move;
}

function infantry_pain(self: Entity): void {
    self.monsterinfo.current_move = pain_move;
}

function infantry_die(self: Entity): void {
    self.monsterinfo.current_move = death_move;
}

function infantry_duck(self: Entity): void {
    self.monsterinfo.current_move = duck_move;
}

// Frames
const stand_frames: MonsterFrame[] = Array.from({ length: 22 }, () => ({
    ai: monster_ai_stand,
    dist: 0,
}));

stand_move = {
    firstframe: 0,
    lastframe: 21,
    frames: stand_frames,
    endfunc: infantry_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 15 }, () => ({
    ai: monster_ai_walk,
    dist: 4,
}));

walk_move = {
    firstframe: 22,
    lastframe: 36,
    frames: walk_frames,
    endfunc: infantry_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 8 }, () => ({
    ai: monster_ai_run,
    dist: 12,
}));

run_move = {
    firstframe: 37,
    lastframe: 44,
    frames: run_frames,
    endfunc: infantry_run,
};

// Attack: Fire on frames 5, 6, 7
const attack_frames: MonsterFrame[] = Array.from({ length: 15 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i >= 5 && i <= 7) ? infantry_fire : null,
}));

attack_move = {
    firstframe: 45,
    lastframe: 59,
    frames: attack_frames,
    endfunc: infantry_run,
};

const pain_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0,
}));

pain_move = {
    firstframe: 60,
    lastframe: 69,
    frames: pain_frames,
    endfunc: infantry_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
    ai: monster_ai_move,
    dist: 0,
}));

function infantry_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
}

death_move = {
    firstframe: 70,
    lastframe: 89,
    frames: death_frames,
    endfunc: infantry_dead,
};

const duck_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({
    ai: monster_ai_move,
    dist: 0,
}));

duck_move = {
    firstframe: 90, // Hypothetical start for duck
    lastframe: 94,
    frames: duck_frames,
    endfunc: infantry_run, // Return to run
};

export function SP_monster_infantry(self: Entity, context: SpawnContext): void {
    self.model = 'models/monsters/infantry/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.health = 100;
    self.max_health = 100;
    self.mass = 200;
    self.takedamage = true;

    self.pain = (self, other, kick, damage) => {
        if (self.health < (self.max_health / 2)) {
            self.monsterinfo.current_move = pain_move;
        }
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        self.deadflag = DeadFlag.Dead;
        self.solid = Solid.Not;

        if (self.health < -40) {
            throwGibs(context.entities, self.origin, damage);
            context.entities.free(self);
            return;
        }

        infantry_die(self);
    };

    self.monsterinfo.stand = infantry_stand;
    self.monsterinfo.walk = infantry_walk;
    self.monsterinfo.run = infantry_run;
    self.monsterinfo.attack = infantry_attack;

    // Infantry special: dodge
    // This could be hooked up in monster_think or specific logic
    // For now, we expose a custom method if needed?
    // self.monsterinfo.dodge = infantry_duck; // If we add dodge to MonsterInfo interface

    self.think = monster_think;

    infantry_stand(self);
    self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerInfantrySpawns(registry: SpawnRegistry): void {
    registry.register('monster_infantry', SP_monster_infantry);
}
