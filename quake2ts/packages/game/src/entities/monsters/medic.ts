import { normalizeVec3, subtractVec3, Vec3, TempEntity, ServerCommand, angleVectors, addVec3, scaleVec3 } from '@quake2ts/shared';
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
import { T_Damage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { throwGibs } from '../gibs.js';
import { rangeTo, RangeCategory, infront, visible, TraceResult } from '../../ai/perception.js';
import { monster_fire_blaster } from './attack.js';
import { EntitySystem } from '../system.js';
import { MulticastType } from '../../imports.js';
import { CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_DEADMONSTER } from '@quake2ts/shared';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  if (self.classname === 'monster_medic') {
    if (medic_find_dead(self, context as EntitySystem)) {
        self.monsterinfo.current_move = run_move;
        return;
    }
  }
  ai_stand(self, MONSTER_TICK, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  if (self.classname === 'monster_medic') {
    // Medic custom run logic to find dead monsters
    if (medic_find_dead(self, context as EntitySystem)) {
        self.monsterinfo.current_move = run_move;
    } else {
        ai_run(self, dist, MONSTER_TICK, context);
    }
  } else {
    // Medic Commander just runs
    ai_run(self, dist, MONSTER_TICK, context);
  }
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_hyper_move: MonsterMove;
let attack_cable_move: MonsterMove; // Healing animation
let spawn_move: MonsterMove; // Commander reinforcement spawn
let pain_move: MonsterMove;
let death_move: MonsterMove;

function medic_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function medic_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function medic_run(self: Entity): void {
  if (self.classname === 'monster_medic') {
    // Check if we have a goalentity that is a dead monster
    if (self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
        // We are chasing a dead monster to heal it
        const dist = rangeTo(self, self.enemy);
        if (dist < 80) {
            // Close enough to heal
            self.monsterinfo.current_move = attack_cable_move;
            return;
        }
    }
  }

  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function medic_attack(self: Entity): void {
  // If enemy is dead (and is a monster), heal it
  if (self.classname === 'monster_medic' && self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
      self.monsterinfo.current_move = attack_cable_move;
      return;
  }

  // Commander spawning check
  if (self.classname === 'monster_medic_commander') {
    // Chance to spawn reinforcements if not already doing so
    if (Math.random() < 0.2) { // 20% chance to spawn instead of attacking
       self.monsterinfo.current_move = spawn_move;
       return;
    }
  }

  self.monsterinfo.current_move = attack_hyper_move;
}

function medic_fire_blaster(self: Entity, context: any): void {
    if (!self.enemy || self.enemy.health <= 0) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_blaster(self, start, forward, 2, 1000, 0, 0, context, DamageMod.HYPERBLASTER);
}

function medic_cable_attack(self: Entity, context: EntitySystem): void {
  if (!self.enemy || self.enemy.deadflag !== DeadFlag.Dead) {
    return;
  }

  const dist = rangeTo(self, self.enemy);
  if (dist > 400) {
    // Too far, stop healing
    self.monsterinfo.current_move = run_move;
    return;
  }

  // Calculate muzzle position (medic's weapon/hand)
  const vectors = angleVectors(self.angles);
  const f = vectors.forward;
  const r = vectors.right;
  const u = vectors.up;

  const offset = { x: 24, y: 0, z: 6 }; // Approximate muzzle offset
  const start = addVec3(
      self.origin,
      addVec3(
          scaleVec3(f, offset.x),
          addVec3(scaleVec3(r, offset.y), scaleVec3(u, offset.z))
      )
  );

  const end = self.enemy.origin;

  context.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, {
      te: TempEntity.MEDIC_CABLE_ATTACK,
      entId: self.index,
      targetId: self.enemy.index,
      start: start,
      end: end
  } as any);
}

function medic_hook_launch(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'medic/medatck2.wav', 1, 1, 0);
  medic_cable_attack(self, context);
}

function medic_hook_retract(self: Entity, context: EntitySystem): void {
  if (!self.enemy || self.enemy.deadflag !== DeadFlag.Dead) {
      return;
  }

  const ent = self.enemy;
  const spawnFunc = context.getSpawnFunction(ent.classname);

  // Also check distance one last time to be sure
  if (rangeTo(self, ent) > 400) {
      self.enemy = null;
      return;
  }

  if (!spawnFunc) {
      ent.deadflag = DeadFlag.Alive;
      ent.health = ent.max_health;
      ent.takedamage = true;
      ent.solid = Solid.BoundingBox;
      ent.nextthink = context.timeSeconds + 0.1;
      if (ent.monsterinfo && ent.monsterinfo.stand) {
          ent.monsterinfo.stand(ent, context);
      }
      // If we couldn't properly spawn, maybe mark as bad?
      (ent as any).bad_medic = self;
  } else {
      const spawnContext: SpawnContext = {
          entities: context,
          keyValues: { classname: ent.classname },
          warn: (msg) => {},
          free: (e) => context.free(e),
          health_multiplier: 1.0,
      };

      const origin = { ...ent.origin };
      const angles = { ...ent.angles };

      spawnFunc(ent, spawnContext);

      ent.origin = origin;
      ent.angles = angles;
      context.linkentity(ent);

      ent.deadflag = DeadFlag.Alive;
      ent.takedamage = true;
      context.finalizeSpawn(ent);
  }

  // Stop chasing
  self.enemy = null;
}

function medic_find_dead(self: Entity, context: EntitySystem): boolean {
    if (self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
        return true;
    }

    if (Math.random() > 0.2) return false;

    let best: Entity | null = null;
    let bestDist = 1024;

    const traceWrapper = (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, ignore: Entity | null, mask: number): TraceResult => {
        const res = context.trace(start, mins, maxs, end, ignore, mask);
        return {
            fraction: res.fraction,
            ent: res.ent
        };
    };

    context.forEachEntity((ent) => {
        if (ent === self) return;
        if (ent.deadflag !== DeadFlag.Dead) return;
        if (!ent.monsterinfo) return;
        if (ent.classname === 'monster_medic') return;
        if ((ent as any).bad_medic === self) return;

        if (!visible(self, ent, traceWrapper)) return;

        const dist = rangeTo(self, ent);
        if (dist < bestDist) {
            bestDist = dist;
            best = ent;
        }
    });

    if (best) {
        self.enemy = best;
        return true;
    }

    return false;
}

function medic_call_reinforcements(self: Entity, context: EntitySystem): void {
  // Weighted random spawn logic
  const r = Math.random();
  let chosenClass = 'monster_soldier_light'; // 50%
  if (r > 0.8) {
      chosenClass = 'monster_soldier_ssg'; // 20%
  } else if (r > 0.5) {
      chosenClass = 'monster_soldier'; // 30%
  }

  const spawnFunc = context.getSpawnFunction(chosenClass);

  if (spawnFunc) {
      // Find a spot in front of the medic
      const vectors = angleVectors(self.angles);
      const forwardDist = scaleVec3(vectors.forward, 64);
      const spawnOrigin = addVec3(self.origin, forwardDist);

      // Vectors are readonly, create new object for modification
      const adjustedOrigin = { ...spawnOrigin, z: spawnOrigin.z + 8 }; // Slight lift

      // Check if spot is clear
      const tr = context.trace(self.origin, { x: -16, y: -16, z: -24 }, { x: 16, y: 16, z: 32 }, adjustedOrigin, self, CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_DEADMONSTER);

      if (tr.fraction < 1.0 || tr.startsolid || tr.allsolid) {
          // Blocked, don't spawn
          return;
      }

      const ent = context.spawn();
      ent.origin = adjustedOrigin;
      ent.angles = { ...self.angles };

      const spawnContext: SpawnContext = {
        entities: context,
        keyValues: { classname: chosenClass },
        warn: () => {},
        free: (e) => context.free(e),
        health_multiplier: 1.0,
      };

      spawnFunc(ent, spawnContext);

      // Make the new monster angry at the medic's enemy
      ent.enemy = self.enemy;

      // Visual effect for spawn?
      context.multicast(adjustedOrigin, MulticastType.Pvs, ServerCommand.muzzleflash, {
        entId: ent.index,
        flash_number: 0 // generic flash
      } as any);

      context.engine.sound?.(self, 0, 'medic/medatck2.wav', 1, 1, 0); // Reuse sound
  }
}

function medic_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function medic_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function medic_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}


// Frame definitions (approximated)
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: medic_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
  ai: monster_ai_walk,
  dist: 3,
}));

walk_move = {
  firstframe: 30,
  lastframe: 69,
  frames: walk_frames,
  endfunc: medic_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 12,
}));

run_move = {
  firstframe: 70,
  lastframe: 89,
  frames: run_frames,
  endfunc: medic_run,
};

const attack_hyper_frames: MonsterFrame[] = Array.from({ length: 16 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i >= 4 && i <= 13) ? medic_fire_blaster : null
}));

attack_hyper_move = {
    firstframe: 90,
    lastframe: 105,
    frames: attack_hyper_frames,
    endfunc: medic_run
};

const attack_cable_frames: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 0, think: medic_hook_launch },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_cable_attack },
  { ai: monster_ai_charge, dist: 0, think: medic_hook_retract }
];

attack_cable_move = {
    firstframe: 106,
    lastframe: 114,
    frames: attack_cable_frames,
    endfunc: medic_run
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 116,
  lastframe: 121,
  frames: pain_frames,
  endfunc: medic_run,
};

// Reinforcement spawn frames (FRAME_attack33-55: 122-144)
const spawn_frames: MonsterFrame[] = Array.from({ length: 23 }, (_, i) => ({
    ai: monster_ai_move,
    dist: 0,
    think: (i === 11) ? medic_call_reinforcements : null // Trigger halfway
}));

spawn_move = {
    firstframe: 122,
    lastframe: 144,
    frames: spawn_frames,
    endfunc: medic_run
};

// Death frames should be 161-190.
// But we need to make sure we don't break existing medic if it relies on old frames.
// Assuming standard model has > 161 frames.
const death_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 161,
  lastframe: 190,
  frames: death_frames,
  endfunc: medic_dead,
};


export function SP_monster_medic(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_medic';
  self.model = 'models/monsters/medic/tris.md2';
  self.mins = { x: -24, y: -24, z: -24 };
  self.maxs = { x: 24, y: 24, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 300;
  self.max_health = 300;
  self.mass = 400;
  self.takedamage = true;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
      // Pain sound logic
      if (Math.random() < 0.5) {
          const sound = self.classname === 'monster_medic_commander'
              ? 'medic/medpain2.wav'
              : 'medic/medpain1.wav';
          context.entities.sound?.(self, 0, sound, 1, 1, 0);
      }
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

    medic_die(self);
  };

  self.monsterinfo.stand = medic_stand;
  self.monsterinfo.walk = medic_walk;
  self.monsterinfo.run = medic_run;
  self.monsterinfo.attack = medic_attack;

  self.think = monster_think;

  medic_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function SP_monster_medic_commander(self: Entity, context: SpawnContext): void {
    SP_monster_medic(self, context);
    self.classname = 'monster_medic_commander';
    self.health = 600;
    self.max_health = 600;
    self.skin = 1; // Commander skin

    // Commander doesn't heal, it spawns.
    // Logic is handled in medic_attack and medic_run via classname check.
}

export function registerMedicSpawns(registry: SpawnRegistry): void {
  registry.register('monster_medic', SP_monster_medic);
  registry.register('monster_medic_commander', SP_monster_medic_commander);
}
