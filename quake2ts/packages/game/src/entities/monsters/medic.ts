import { normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
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

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  if (medic_find_dead(self, context as EntitySystem)) {
      self.monsterinfo.current_move = run_move;
      return;
  }
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  // Medic custom run logic to find dead monsters
  if (medic_find_dead(self, context as EntitySystem)) {
      self.monsterinfo.current_move = run_move;
  } else {
      ai_run(self, dist, MONSTER_TICK);
  }
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
let attack_hyper_move: MonsterMove;
let attack_cable_move: MonsterMove; // Healing animation
let pain_move: MonsterMove;
let death_move: MonsterMove;

function medic_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function medic_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function medic_run(self: Entity): void {
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

  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function medic_attack(self: Entity): void {
  // If enemy is dead (and is a monster), heal it
  if (self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
      self.monsterinfo.current_move = attack_cable_move;
      return;
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

function medic_heal(self: Entity, context: EntitySystem): void {
    if (!self.enemy || self.enemy.deadflag !== DeadFlag.Dead) {
        return;
    }

    // Resurrection logic
    const ent = self.enemy;

    // Spawn cable effect (TODO: visual effect)
    // context.multicast(self.origin, ... TempEntity.MEDIC_CABLE_ATTACK ...)

    // Revive
    ent.deadflag = DeadFlag.Alive;
    ent.health = ent.max_health;
    ent.takedamage = true;
    ent.solid = Solid.BoundingBox; // Restore solid
    ent.nextthink = context.timeSeconds + 0.1;

    // Reset monster state
    if (ent.monsterinfo && ent.monsterinfo.stand) {
        ent.monsterinfo.stand(ent);
    }

    // Stop chasing this one
    self.enemy = null;
}

function medic_find_dead(self: Entity, context: EntitySystem): boolean {
    // If we already have a dead enemy target, keep it
    if (self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
        return true;
    }

    // Occasional check only
    if (Math.random() > 0.2) return false;

    // Search for dead bodies
    // Iterating all entities is expensive, but standard for Q2 AI
    let best: Entity | null = null;
    let bestDist = 1024; // Healing range limit

    const traceWrapper = (start: Vec3, end: Vec3, ignore: Entity, mask: number): TraceResult => {
        const res = context.trace(start, null, null, end, ignore, mask);
        return {
            fraction: res.fraction,
            entity: res.ent
        };
    };

    context.forEachEntity((ent) => {
        if (ent === self) return;
        if (ent.deadflag !== DeadFlag.Dead) return;
        if (!ent.monsterinfo) return; // Only heal monsters
        if (ent.classname === 'monster_medic') return; // Don't heal other medics (usually)

        // Must be visible and reachable
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

const attack_cable_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 5 ? medic_heal : null
}));

attack_cable_move = {
    firstframe: 106, // Assume frames come after hyper attack
    lastframe: 115,
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

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 122,
  lastframe: 131,
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

export function registerMedicSpawns(registry: SpawnRegistry): void {
  registry.register('monster_medic', SP_monster_medic);
}
