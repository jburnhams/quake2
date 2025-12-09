import { normalizeVec3, subtractVec3, Vec3, TempEntity, ServerCommand, angleVectors, addVec3, scaleVec3, lengthVec3 } from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import {
  AiFlags,
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Reinforcement,
  Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { T_Damage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { throwGibs, GIB_METALLIC } from '../gibs.js';
import { rangeTo, RangeCategory, infront, visible, TraceResult } from '../../ai/perception.js';
import { checkGroundSpawnPoint, findSpawnPoint } from '../../ai/spawn_utils.js';
import { monster_fire_blaster } from './attack.js';
import { EntitySystem } from '../system.js';
import { MulticastType } from '../../imports.js';
import { CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_DEADMONSTER } from '@quake2ts/shared';
import { SpawnGrow_Spawn } from '../spawngro.js';

const MONSTER_TICK = 0.1;
const MAX_REINFORCEMENTS = 5; // C++ constant implied by array size

const default_reinforcements = "monster_soldier_light 1;monster_soldier 2;monster_soldier_ss 2;monster_infantry 3;monster_gunner 4;monster_medic 5;monster_gladiator 6";
const default_monster_slots_base = 3;

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
let call_reinforcements_move: MonsterMove; // Commander reinforcement spawn
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

function medic_slots_left(self: Entity): number {
    if (!self.monsterinfo.monster_slots) return 0;
    return self.monsterinfo.monster_slots - (self.monsterinfo.monster_used || 0);
}

function medic_attack(self: Entity, context: EntitySystem): void {
  // If enemy is dead (and is a monster), heal it
  if (self.classname === 'monster_medic' && self.enemy && self.enemy.deadflag === DeadFlag.Dead) {
      self.monsterinfo.current_move = attack_cable_move;
      return;
  }

  // Commander spawning check
  if (self.classname === 'monster_medic_commander') {
    const slotsLeft = medic_slots_left(self);
    // Chance to spawn reinforcements if not already doing so
    if (slotsLeft > 0 && context.rng.frandom() < 0.2) { // 20% chance to spawn instead of attacking
       self.monsterinfo.current_move = call_reinforcements_move;
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

  context.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity,
      TempEntity.MEDIC_CABLE_ATTACK,
      self.index,
      self.enemy.index,
      start,
      end
  );
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

    if (context.rng.frandom() > 0.2) return false;

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

// ----------------------------------------------------------------------------
// REINFORCEMENTS
// ----------------------------------------------------------------------------

function medic_setup_reinforcements(self: Entity, str: string, context: EntitySystem): void {
    if (!str) return;

    self.monsterinfo.reinforcements = [];

    const parts = str.split(';');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const spaceIdx = trimmed.lastIndexOf(' ');
        if (spaceIdx === -1) continue;

        const classname = trimmed.substring(0, spaceIdx).trim();
        const strength = parseInt(trimmed.substring(spaceIdx + 1).trim(), 10);

        if (isNaN(strength)) continue;

        // Spawn a temp entity to get mins/maxs
        // This is a bit expensive but done only once at spawn
        const spawnFunc = context.getSpawnFunction(classname);
        if (!spawnFunc) {
            continue;
        }

        const tempEnt = context.spawn();
        tempEnt.classname = classname;
        // Suppress linking

        const spawnContext: SpawnContext = {
            entities: context,
            keyValues: { classname },
            warn: () => {},
            free: (e) => context.free(e),
            health_multiplier: 1.0,
        };
        spawnFunc(tempEnt, spawnContext);

        self.monsterinfo.reinforcements.push({
            classname,
            strength,
            mins: { ...tempEnt.mins },
            maxs: { ...tempEnt.maxs }
        });

        context.free(tempEnt);
    }
}

function medic_pick_reinforcements(self: Entity, context: EntitySystem): number[] {
    const chosen: number[] = [];
    if (!self.monsterinfo.reinforcements) return chosen;

    const inverse_log_slots = Math.pow(2, MAX_REINFORCEMENTS);
    const slots = Math.max(1, Math.floor(Math.log2(context.rng.frandom() * inverse_log_slots)));

    let remaining = medic_slots_left(self);

    for (let i = 0; i < slots; i++) {
        if (remaining <= 0) break;

        const available: number[] = [];
        for (let j = 0; j < self.monsterinfo.reinforcements.length; j++) {
            if (self.monsterinfo.reinforcements[j].strength <= remaining) {
                available.push(j);
            }
        }

        if (available.length === 0) break;

        const pick = available[Math.floor(context.rng.frandom() * available.length)];
        chosen.push(pick);
        remaining -= self.monsterinfo.reinforcements[pick].strength;
    }

    return chosen;
}

const reinforcement_position: Vec3[] = [
	{ x: 80, y: 0, z: 0 },
	{ x: 40, y: 60, z: 0 },
	{ x: 40, y: -60, z: 0 },
	{ x: 0, y: 80, z: 0 },
	{ x: 0, y: -80, z: 0 }
];

function M_ProjectFlashSource(self: Entity, offset: Vec3, f: Vec3, r: Vec3): Vec3 {
    // Equivalent to G_ProjectSource logic but simpler for monsters usually
    // Assuming origin is feet
    // return origin + offset.x*f + offset.y*r + (0,0,offset.z)
    // Actually rerelease uses G_ProjectSource logic usually
    // But let's assume standard vector math
    const u = { x: 0, y: 0, z: 1 };

    // offset[0] * forward + offset[1] * right + offset[2] * up
    const p1 = scaleVec3(f, offset.x);
    const p2 = scaleVec3(r, offset.y);
    const p3 = scaleVec3(u, offset.z); // Or use up vector if self has one, but monsters usually z-up

    return addVec3(self.origin, addVec3(p1, addVec3(p2, p3)));
}

function medic_start_spawn(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, 'medic_commander/monsterspawn1.wav', 1, 1, 0);
    // Next frame is set by animation system (current_move -> frames)
}

function medic_determine_spawn(self: Entity, context: EntitySystem): void {
    const vectors = angleVectors(self.angles);
    const f = vectors.forward;
    const r = vectors.right;

    self.monsterinfo.chosen_reinforcements = medic_pick_reinforcements(self, context);
    const num_summoned = self.monsterinfo.chosen_reinforcements.length;

    let num_success = 0;

    // Helper to find spawn point
    const findSpot = (start: Vec3, mins: Vec3, maxs: Vec3): Vec3 | null => {
         const spawnPoint = findSpawnPoint(start, mins, maxs, context);
         if (spawnPoint) {
             if (checkGroundSpawnPoint(spawnPoint, mins, maxs, 256, -1, context)) {
                 return spawnPoint;
             }
         }
         return null;
    };

    // First pass
    for (let count = 0; count < num_summoned; count++) {
        const reinIdx = self.monsterinfo.chosen_reinforcements![count];
        const reinforcement = self.monsterinfo.reinforcements![reinIdx];

        let offset = { ...reinforcement_position[count] };

        const rawStart = M_ProjectFlashSource(self, offset, f, r);
        const startpoint = { ...rawStart, z: rawStart.z + 10 };

        const spot = findSpot(startpoint, reinforcement.mins, reinforcement.maxs);
        if (spot) {
            num_success++;
            break;
        }
    }

    // Second pass: spin around check
    if (num_success === 0) {
        for (let count = 0; count < num_summoned; count++) {
             const reinIdx = self.monsterinfo.chosen_reinforcements![count];
             const reinforcement = self.monsterinfo.reinforcements![reinIdx];

             let offset = { ...reinforcement_position[count] };
             // check behind
             offset.x *= -1.0;
             offset.y *= -1.0;

             const rawStart = M_ProjectFlashSource(self, offset, f, r);
             const startpoint = { ...rawStart, z: rawStart.z + 10 };

             const spot = findSpot(startpoint, reinforcement.mins, reinforcement.maxs);
             if (spot) {
                 num_success++;
                 break;
             }
        }

        if (num_success > 0) {
            self.monsterinfo.aiflags |= AiFlags.ManualTarget; // AI_MANUAL_STEERING
            self.ideal_yaw = (self.angles.y + 180) % 360;
        }
    }

    if (num_success === 0) {
        // Fail
        self.monsterinfo.nextframe = 142; // FRAME_attack53 - skip spawn
    }
}

function medic_spawngrows(self: Entity, context: EntitySystem): void {
    const vectors = angleVectors(self.angles);
    const f = vectors.forward;
    const r = vectors.right;

    // Rotation logic (Manual Steering)
    if (self.monsterinfo.aiflags & AiFlags.ManualTarget) {
        // Simplified turn logic
        const diff = Math.abs(self.angles.y - self.ideal_yaw);
        if (diff > 0.1) {
             self.monsterinfo.aiflags |= AiFlags.HoldFrame;
             return;
        }
        self.monsterinfo.aiflags &= ~AiFlags.HoldFrame;
        self.monsterinfo.aiflags &= ~AiFlags.ManualTarget;
    }

    if (!self.monsterinfo.chosen_reinforcements) return;

    const num_summoned = self.monsterinfo.chosen_reinforcements.length;
    let num_success = 0;

    for (let count = 0; count < num_summoned; count++) {
        const reinIdx = self.monsterinfo.chosen_reinforcements[count];
        const reinforcement = self.monsterinfo.reinforcements![reinIdx];

        const offset = { ...reinforcement_position[count] };

        const rawStart = M_ProjectFlashSource(self, offset, f, r);
        const startpoint = { ...rawStart, z: rawStart.z + 10 };

        const spawnPoint = findSpawnPoint(startpoint, reinforcement.mins, reinforcement.maxs, context);
        if (spawnPoint) {
            if (checkGroundSpawnPoint(spawnPoint, reinforcement.mins, reinforcement.maxs, 256, -1, context)) {
                num_success++;
                // SpawnGrow
                const radius = lengthVec3(subtractVec3(reinforcement.maxs, reinforcement.mins)) * 0.5;
                const growPos = addVec3(spawnPoint, addVec3(reinforcement.mins, reinforcement.maxs));

                SpawnGrow_Spawn(context, growPos, radius, radius * 2.0);
            }
        }
    }
}

function medic_finish_spawn(self: Entity, context: EntitySystem): void {
    if (!self.monsterinfo.chosen_reinforcements) return;

    const vectors = angleVectors(self.angles);
    const f = vectors.forward;
    const r = vectors.right;

    const num_summoned = self.monsterinfo.chosen_reinforcements.length;

    for (let count = 0; count < num_summoned; count++) {
        const reinIdx = self.monsterinfo.chosen_reinforcements[count];
        const reinforcement = self.monsterinfo.reinforcements![reinIdx];

        const offset = { ...reinforcement_position[count] };

        const rawStart = M_ProjectFlashSource(self, offset, f, r);
        const startpoint = { ...rawStart, z: rawStart.z + 10 };

        const spawnPoint = findSpawnPoint(startpoint, reinforcement.mins, reinforcement.maxs, context);
        let ent: Entity | null = null;

        if (spawnPoint) {
             // CreateGroundMonster equivalent
             if (checkGroundSpawnPoint(spawnPoint, reinforcement.mins, reinforcement.maxs, 256, -1, context)) {
                 const spawnFunc = context.getSpawnFunction(reinforcement.classname);
                 if (spawnFunc) {
                     ent = context.spawn();
                     ent.origin = { ...spawnPoint };
                     ent.angles = { ...self.angles };

                     const spawnContext: SpawnContext = {
                        entities: context,
                        keyValues: { classname: reinforcement.classname },
                        warn: () => {},
                        free: (e) => context.free(e),
                        health_multiplier: 1.0,
                    };
                    spawnFunc(ent, spawnContext);
                 }
             }
        }

        if (!ent) continue;

        ent.monsterinfo.aiflags |= AiFlags.DoNotCount;
        ent.monsterinfo.monster_slots = reinforcement.strength;

        self.monsterinfo.monster_used = (self.monsterinfo.monster_used || 0) + reinforcement.strength;

        // Target assignment logic
        const target = self.enemy;
        if (target && target.health > 0) {
            ent.enemy = target;
            if (ent.monsterinfo.run) {
                 ent.monsterinfo.run(ent, context);
            }
        } else {
             ent.enemy = null;
             if (ent.monsterinfo.stand) ent.monsterinfo.stand(ent, context);
        }
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
const call_reinforcements_frames: MonsterFrame[] = Array.from({ length: 23 }, (_, i) => {
    let think = null;
    if (i === 9) think = medic_start_spawn;
    else if (i === 15) think = medic_determine_spawn;
    else if (i === 16) think = medic_spawngrows;
    else if (i === 19) think = medic_finish_spawn;

    return {
        ai: monster_ai_move,
        dist: 0,
        think
    };
});

call_reinforcements_move = {
    firstframe: 122,
    lastframe: 144,
    frames: call_reinforcements_frames,
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
  self.health = 300 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 400;
  self.takedamage = true;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
      // Pain sound logic
      if (context.entities.rng.frandom() < 0.5) {
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
        throwGibs(context.entities, self.origin, damage, GIB_METALLIC);
        context.entities.free(self);
        return;
    }

    medic_die(self);
  };

  self.monsterinfo.stand = medic_stand;
  self.monsterinfo.walk = medic_walk;
  self.monsterinfo.run = medic_run;
  self.monsterinfo.attack = (ent) => medic_attack(ent, context.entities);

  self.think = monster_think;

  medic_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function SP_monster_medic_commander(self: Entity, context: SpawnContext): void {
    SP_monster_medic(self, context);
    self.classname = 'monster_medic_commander';
    self.health = 600 * context.health_multiplier;
    self.max_health = self.health;
    self.skin = 1; // Commander skin

    // Commander doesn't heal, it spawns.
    // Logic is handled in medic_attack and medic_run via classname check.

    // Setup reinforcements
    let reinforcements = default_reinforcements;
    if (context.keyValues['reinforcements']) {
        reinforcements = context.keyValues['reinforcements'];
    }

    // Check monster_slots
    if (context.keyValues['monster_slots']) {
        self.monsterinfo.monster_slots = parseInt(context.keyValues['monster_slots'], 10);
    } else {
        self.monsterinfo.monster_slots = default_monster_slots_base;
    }

    if (self.monsterinfo.monster_slots && reinforcements) {
        medic_setup_reinforcements(self, reinforcements, context.entities);
    }

    // Precache models?
    // MedicCommanderCache();
    context.entities.engine.modelIndex?.("models/items/spawngro3/tris.md2");
}

export function registerMedicSpawns(registry: SpawnRegistry): void {
  registry.register('monster_medic', SP_monster_medic);
  registry.register('monster_medic_commander', SP_monster_medic_commander);
}
