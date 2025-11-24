import { Entity, MonsterFrame, MonsterMove, MoveType, Solid, DeadFlag } from '../entity.js';
import { monster_think, ai_stand, ai_walk, ai_run, ai_charge } from '../../ai/index.js';
import { SpawnContext } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { addVec3, scaleVec3, Vec3 } from '@quake2ts/shared';
import { MuzzleFlash, MONSTER_FLASH_OFFSETS } from '../../combat/muzzleflash.js';

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
  ai_run(self, dist, MONSTER_TICK, context);
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
    self.movetype = config.fly ? MoveType.Step : MoveType.Step;

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

export function projectFlashSource(self: Entity, flashType: MuzzleFlash, forward: Vec3, right: Vec3): Vec3 {
  const offset = MONSTER_FLASH_OFFSETS[flashType] || { x: 0, y: 0, z: 0 };

  // start = self.s.origin + forward * offset[0] + right * offset[1] + up * offset[2]
  // In JS:
  // start = origin + forward * x + right * y + up * z
  // But we don't have up vector passed in.
  // Usually up is {0,0,1} in Q2 entity space unless rotated?
  // Or we assume Up is cross(right, forward)?
  // Let's assume we calculate Up or just use Z offset if aligned?
  // Q2 `M_ProjectFlashSource` takes forward and right.
  // And it computes up via CrossProduct(right, forward, up).
  // Wait, Q2 CrossProduct order?
  // shared/math/vec3.ts `crossVec3(a, b)`:
  // x = a.y * b.z - a.z * b.y
  // Up = Right x Forward? Or Forward x Right?
  // Standard Right-Hand Rule: Forward x Left = Up?
  // Q2 uses:
  // AngleVectors (angles, forward, right, up);
  // So we can trust angleVectors to give us Up if we asked for it.
  // But `projectFlashSource` signature in common.ts only has forward/right.
  // Let's calculate Up.

  const up: Vec3 = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x
  };
  // Check direction: Right x Forward.
  // If Forward is X, Right is -Y (Q2 convention: Yaw 0 -> X, Left is Y).
  // Wait, Q2 AngleVectors:
  // forward: cp * cy, ...
  // right: ... -sr*sp*cy ...
  // up: ...
  // Let's just calculate it or change signature to accept up.
  // Changing signature requires changing calls.
  // Let's calculate it here to be safe.

  let start = addVec3(self.origin, scaleVec3(forward, offset.x));
  start = addVec3(start, scaleVec3(right, offset.y));
  start = addVec3(start, scaleVec3(up, offset.z));

  return start;
}
