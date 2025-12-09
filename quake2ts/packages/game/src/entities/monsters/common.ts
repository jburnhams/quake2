import { Entity, MonsterFrame, MonsterMove, MoveType, Solid, DeadFlag } from '../entity.js';
import { monster_think, ai_stand, ai_walk, ai_run, ai_charge } from '../../ai/index.js';
import { SpawnContext } from '../spawn.js';
import { throwGibs, GIB_ORGANIC } from '../gibs.js';
import { Vec3, addVec3, scaleVec3, MASK_SHOT, ZERO_VEC3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';
import { EntitySystem } from '../system.js';
import { DamageMod } from '../../combat/damageMods.js';

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
  ai_stand(self, MONSTER_TICK, context);
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
    self.movetype = config.fly ? MoveType.Step : MoveType.Step; // Fly monsters often use STEP in Q2 if they have AI? No, usually STEP but with FLIGHT flag.
    // Actually, fly monsters in Q2 use MOVETYPE_STEP but set FLIGHT flag (in `monster_start_go`).
    // But `monster_start` often sets MOVETYPE_STEP.

    self.solid = Solid.BoundingBox;
    self.health = config.health * context.health_multiplier;
    self.max_health = self.health;
    self.mass = config.mass;
    self.takedamage = true;

    self.pain = (self, other, kick, damage) => {
      // Placeholder pain
    };

    self.die = (self, inflictor, attacker, damage, point, mod = DamageMod.UNKNOWN) => {
        self.deadflag = DeadFlag.Dead;
        self.solid = Solid.Not;

        if (self.health < -40) {
            throwGibs(context.entities, self.origin, damage, GIB_ORGANIC, mod);
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

export function M_SetAnimation(self: Entity, move: MonsterMove, context: any): void {
  self.monsterinfo.current_move = move;
}

export function M_ShouldReactToPain(self: Entity, context: EntitySystem): boolean {
  if (!context) {
      return true; // Should not happen in proper env
  }
  if (context.skill >= 3) {
    return false;
  }
  return true;
}

export function M_CheckGib(self: Entity, context: any): boolean {
  const gibHealth = (self as any).gib_health ?? -40;
  return self.health < gibHealth;
}

export function M_AllowSpawn(self: Entity, context: any): boolean {
  return true; // deathmatch checks etc.
}

export function walkmonster_start(self: Entity, context: any): void {
  self.think = monster_think;
  self.nextthink = context.timeSeconds + MONSTER_TICK;
}

export function flymonster_start(self: Entity, context: any): void {
    if (self.health <= 0) return;

    self.movetype = MoveType.Step;
    self.takedamage = true;
    self.solid = Solid.BoundingBox;

    // walkmonster_start sets think and nextthink
    walkmonster_start(self, context);
}

export function M_ProjectFlashSource(self: Entity, offset: Vec3, forward: Vec3, right: Vec3): Vec3 {
  const start = addVec3(self.origin, scaleVec3(forward, offset.x));
  const start2 = addVec3(start, scaleVec3(right, offset.y));
  const start3 = addVec3(start2, { x: 0, y: 0, z: offset.z });
  return start3;
}

export function M_MonsterDodge(self: Entity, attacker: Entity, eta: number): void {
    // Stub implementation
}

export function M_CheckClearShot(self: Entity, offset: Vec3, context: EntitySystem): boolean {
    if (!self.enemy) return false;

    // Get the firing start position
    // Assuming self.angles is correct for facing
    // We don't have direct access to 'forward' and 'right' vectors here unless we calculate them
    // But this function is usually called with an offset from monster_flash_offset
    // which assumes a certain orientation.
    // For now, let's just do a simple trace from origin+viewheight to enemy origin.

    const start = { ...self.origin };
    start.z += self.viewheight;

    const end = { ...self.enemy.origin };
    end.z += self.enemy.viewheight; // Aim at eyes? Or origin? origin is at feet usually.

    const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

    if (tr.fraction === 1.0 || tr.ent === self.enemy) {
        return true;
    }

    return false;
}

// Helper to check if a blindfire shot is viable
export function M_AdjustBlindfireTarget(self: Entity, start: Vec3, target: Vec3, right: Vec3, context: any): Vec3 | null {
  const tr = context.trace(start, target, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

  if (!tr.startsolid && !tr.allsolid && tr.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(target, start));
  }

  // Try left
  const leftTarget = addVec3(target, scaleVec3(right, -20));
  const trLeft = context.trace(start, leftTarget, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);
  if (!trLeft.startsolid && !trLeft.allsolid && trLeft.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(leftTarget, start));
  }

  // Try right
  const rightTarget = addVec3(target, scaleVec3(right, 20));
  const trRight = context.trace(start, rightTarget, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);
  if (!trRight.startsolid && !trRight.allsolid && trRight.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(rightTarget, start));
  }

  return null;
}
