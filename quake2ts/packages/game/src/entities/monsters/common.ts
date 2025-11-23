import { Entity, MonsterFrame, MonsterMove, MoveType, Solid, DeadFlag } from '../entity.js';
import { monster_think, ai_stand, ai_walk, ai_run, ai_charge } from '../../ai/index.js';
import { SpawnContext } from '../spawn.js';
import { throwGibs } from '../gibs.js';

const MONSTER_TICK = 0.1;

export interface MonsterConfig {
  model: string;
  health: number;
  mass: number;
  mins?: { x: number; y: number; z: number };
  maxs?: { x: number; y: number; z: number };
  fly?: boolean;
}

// Generic moves for monsters that don't have full animation tables yet
function generic_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
}

function generic_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function generic_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, MONSTER_TICK);
}

const generic_stand_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
  ai: generic_ai_stand,
  dist: 0,
}));

const generic_stand_move: MonsterMove = {
  firstframe: 0,
  lastframe: 0,
  frames: generic_stand_frames,
  endfunc: (self) => { self.monsterinfo.current_move = generic_stand_move; },
};

const generic_walk_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
  ai: generic_ai_walk,
  dist: 5,
}));

const generic_walk_move: MonsterMove = {
  firstframe: 0,
  lastframe: 0,
  frames: generic_walk_frames,
  endfunc: (self) => { self.monsterinfo.current_move = generic_walk_move; },
};

const generic_run_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
    ai: generic_ai_run,
    dist: 10,
}));

const generic_run_move: MonsterMove = {
    firstframe: 0,
    lastframe: 0,
    frames: generic_run_frames,
    endfunc: (self) => { self.monsterinfo.current_move = generic_run_move; },
};

export function createMonsterSpawn(config: MonsterConfig) {
  return function(self: Entity, context: SpawnContext): void {
    self.model = config.model;
    self.mins = config.mins || { x: -16, y: -16, z: -24 };
    self.maxs = config.maxs || { x: 16, y: 16, z: 32 };
    self.movetype = config.fly ? MoveType.Step : MoveType.Step; // Fly monsters often use STEP in Q2 if they have AI? No, usually STEP but with FLIGHT flag.
    // Actually, fly monsters in Q2 use MOVETYPE_STEP but set FLIGHT flag (in `monster_start_go`).
    // But `monster_start` often sets MOVETYPE_STEP.

    self.solid = Solid.BoundingBox;
    self.health = config.health;
    self.max_health = config.health;
    self.mass = config.mass;
    self.takedamage = true;

    self.pain = (self, other, kick, damage) => {
      // Placeholder pain
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        self.deadflag = DeadFlag.Dead;
        self.solid = Solid.Not;

        if (self.health < -40) {
            throwGibs(context.entities, self.origin, damage);
            context.entities.free(self);
            return;
        }

        // For now, just remove after a delay
        self.think = (self) => {
            context.entities.free(self);
        };
        self.nextthink = context.entities.timeSeconds + 5;
    };

    // Use generic moves for now
    self.monsterinfo.stand = (self, context) => { self.monsterinfo.current_move = generic_stand_move; };
    self.monsterinfo.walk = (self, context) => { self.monsterinfo.current_move = generic_walk_move; };
    self.monsterinfo.run = (self, context) => { self.monsterinfo.current_move = generic_run_move; };
    self.monsterinfo.attack = (self, context) => { self.monsterinfo.current_move = generic_run_move; }; // No attack move yet

    self.think = monster_think;

    self.monsterinfo.stand(self, context.entities);
    self.nextthink = self.timestamp + MONSTER_TICK;
  };
}
