import { angleVectors, normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
import {
    ai_charge,
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
import { createGrenade } from '../projectiles.js';
import type { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions to match AIAction signature (self, dist)
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

// Forward declarations for moves
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_chain_move: MonsterMove;
let attack_grenade_move: MonsterMove;

function gunner_stand(self: Entity): void {
    self.monsterinfo.current_move = stand_move;
}

function gunner_walk(self: Entity): void {
    self.monsterinfo.current_move = walk_move;
}

function gunner_run(self: Entity): void {
    if (self.enemy && self.enemy.health > 0) {
        self.monsterinfo.current_move = run_move;
    } else {
        self.monsterinfo.current_move = stand_move;
    }
}

function gunner_attack(self: Entity): void {
    // Choose attack based on range or random
    if (Math.random() > 0.5) {
        self.monsterinfo.current_move = attack_chain_move;
    } else {
        self.monsterinfo.current_move = attack_grenade_move;
    }
}

function gunner_fire_chain(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight - 8,
    };

    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));
    const damage = 10;
    const kick = 2;

    monster_fire_bullet(self, start, forward, damage, kick, 0, 0, 0, context, DamageMod.CHAINGUN);
}

function gunner_fire_grenade(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };

    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));
    const damage = 50;
    const speed = 600;

    createGrenade(context as EntitySystem, self, start, forward, damage, speed);
}

// Frames
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
    ai: monster_ai_stand,
    dist: 0,
}));

stand_move = {
    firstframe: 0,
    lastframe: 29,
    frames: stand_frames,
    endfunc: gunner_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
    ai: monster_ai_walk,
    dist: 2,
}));

walk_move = {
    firstframe: 30,
    lastframe: 69,
    frames: walk_frames,
    endfunc: gunner_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
    ai: monster_ai_run,
    dist: 10,
}));

run_move = {
    firstframe: 70,
    lastframe: 89,
    frames: run_frames,
    endfunc: gunner_run,
};

const attack_chain_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i >= 2 && i <= 8) ? gunner_fire_chain : null,
}));

attack_chain_move = {
    firstframe: 90,
    lastframe: 99,
    frames: attack_chain_frames,
    endfunc: gunner_run,
};

const attack_grenade_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 5 ? gunner_fire_grenade : null,
}));

attack_grenade_move = {
    firstframe: 100,
    lastframe: 109,
    frames: attack_grenade_frames,
    endfunc: gunner_run,
};


function SP_monster_gunner(self: Entity, context: SpawnContext): void {
    self.model = 'models/monsters/gunner/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.health = 175;
    self.max_health = 175;
    self.mass = 200;

    self.pain = (self, other, kick, damage) => {
        // Pain logic
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        self.deadflag = DeadFlag.Dead;
        self.solid = Solid.Not;
        // Trigger death animation
    };

    self.monsterinfo.stand = gunner_stand;
    self.monsterinfo.walk = gunner_walk;
    self.monsterinfo.run = gunner_run;
    self.monsterinfo.attack = gunner_attack;

    self.think = monster_think;

    gunner_stand(self);
    self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerGunnerSpawns(registry: SpawnRegistry): void {
    registry.register('monster_gunner', SP_monster_gunner);
}
