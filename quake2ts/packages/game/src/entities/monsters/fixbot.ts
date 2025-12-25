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
  copyVec3,
  vectorToYaw,
  ServerCommand,
  TempEntity
} from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  ai_turn,
  AIFlags,
  visible
} from '../../ai/index.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
  EntityFlags,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs, GIB_METALLIC } from '../gibs.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { M_CheckBottom } from '../../ai/movement.js';
import { EntitySystem } from '../system.js';
import { createBlasterBolt } from '../projectiles.js';
import { monster_fire_blaster } from './attack.js';

type MutableVec3 = { -readonly [P in keyof Vec3]: Vec3[P] };

const MONSTER_TICK = 0.1;

// Wrappers
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, dist, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, context);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations
let fixbot_move_stand: MonsterMove;
let fixbot_move_walk: MonsterMove;
let fixbot_move_run: MonsterMove;
let fixbot_move_attack2: MonsterMove;
let fixbot_move_laserattack: MonsterMove;
let fixbot_move_weld_start: MonsterMove;
let fixbot_move_weld: MonsterMove;
let fixbot_move_weld_end: MonsterMove;
let fixbot_move_start_attack: MonsterMove;
let fixbot_move_pain3: MonsterMove;
let fixbot_move_painb: MonsterMove;
let fixbot_move_paina: MonsterMove;

const MZ2_HOVER_BLASTER_1 = 1; // Placeholder index

function fixbot_set_fly_parameters(self: Entity, heal: boolean, weld: boolean): void {
    // Mimic C implementation
    // self.monsterinfo.fly_position_time = 0;
    // self.monsterinfo.fly_acceleration = 5;
    // self.monsterinfo.fly_speed = 110;
    // self.monsterinfo.fly_buzzard = false;

    if (heal) {
        // self.monsterinfo.fly_min_distance = 100;
        // self.monsterinfo.fly_max_distance = 100;
        // self.monsterinfo.fly_thrusters = true;
    } else if (weld) {
        // self.monsterinfo.fly_min_distance = 24;
        // self.monsterinfo.fly_max_distance = 24;
    } else {
        // timid bot
        // self.monsterinfo.fly_min_distance = 300;
        // self.monsterinfo.fly_max_distance = 500;
    }
}

function fixbot_FindDeadMonster(self: Entity, context: EntitySystem): Entity | null {
    const radius = 1024;
    const candidates = context.findByRadius(self.origin, radius);
    let best: Entity | null = null;

    for (const ent of candidates) {
        if (ent === self) continue;
        if (!(ent.monsterinfo)) continue; // Must be monster
        if (ent.monsterinfo.aiflags & AIFlags.GoodGuy) continue;
        // if (ent.monsterinfo.badMedic...) continue;
        // Check if already has healer?

        if (ent.health > 0) continue; // Must be dead
        if (ent.nextthink && ent.think === context.free) continue; // Should be monster_dead_think but we don't have that easily accessible ref, assuming free means disappearing?
        // Actually dead monsters usually have think = null or specific cleanup.
        // If it's exploding/gibbed, health is very low.
        if (ent.health <= -40) continue; // Gibbed

        if (!visible(self, ent, context.trace)) continue;

        if (!best) {
            best = ent;
            continue;
        }
        if (ent.max_health <= best.max_health) continue; // Pick stronger monster
        best = ent;
    }
    return best;
}

function fixbot_search(self: Entity, context: EntitySystem): void {
    if (self.enemy) return;

    const ent = fixbot_FindDeadMonster(self, context);
    if (ent) {
        self.enemy = ent;
        self.monsterinfo.aiflags |= AIFlags.Medic;
        // FoundTarget(self);
        // We trigger run behavior
        fixbot_run(self);
        fixbot_set_fly_parameters(self, true, false);
    } else {
        // Standard search sound or behavior
        if (context.game.random.frandom() < 0.1) {
             context.engine.sound?.(self, 0, 'flyer/flysght1.wav', 1, 1, 0);
        }
    }
}

function fixbot_dead(self: Entity): void {
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
    self.movetype = MoveType.Toss;
    // self.svflags |= SVF_DEADMONSTER;
    self.nextthink = -1;
}

function fixbot_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod, context: EntitySystem): void {
    context.engine.sound?.(self, 0, 'flyer/flydeth1.wav', 1, 1, 0);
    context.multicast?.(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.EXPLOSION1, self.origin);
    throwGibs(context, self.origin, damage, GIB_METALLIC); // Placeholder for explosion
    self.deadflag = DeadFlag.Dead;
    self.takedamage = false; // Usually dead things don't take damage unless gibbed
    context.free(self); // Explodes, so free?
}

function fixbot_fire_blaster_func(self: Entity, context: EntitySystem): void {
    if (!self.enemy || !self.enemy.inUse) {
        self.monsterinfo.current_move = fixbot_move_run;
        return;
    }

    const vectors = angleVectors(self.angles);
    const start = addVec3(self.origin, addVec3(scaleVec3(vectors.forward, 0), addVec3(scaleVec3(vectors.right, 0), scaleVec3(vectors.up, 0)))); // Offset needed
    // M_ProjectFlashSource(self, monster_flash_offset[MZ2_HOVER_BLASTER_1], forward, right);

    const end = copyVec3(self.enemy.origin);
    (end as MutableVec3).z += (self.enemy.viewheight || 0);
    const dir = normalizeVec3(subtractVec3(end, start));

    monster_fire_blaster(self, start, dir, 15, 1000, MZ2_HOVER_BLASTER_1, 0, context); // EF_BLASTER
}

function fixbot_fire_laser(self: Entity, context: EntitySystem): void {
    // Repair logic
    if (!self.enemy || !self.enemy.inUse || self.enemy.health <= -40) { // gib_health
        self.monsterinfo.current_move = fixbot_move_stand;
        self.monsterinfo.aiflags &= ~AIFlags.Medic;
        return;
    }

    // Beam effect (monster_fire_dabeam) - NOT IMPLEMENTED in this context usually.
    // We will simulate repair.

    if (self.enemy.health < self.enemy.max_health) {
        self.enemy.health += 5; // Healing rate
        if (self.enemy.health > self.enemy.max_health) self.enemy.health = self.enemy.max_health;
    } else {
        // Resurrect if dead?
        if (self.enemy.deadflag === DeadFlag.Dead) {
             // Resurrect logic (reset flags, health, etc)
             self.enemy.deadflag = DeadFlag.Alive;
             self.enemy.solid = Solid.BoundingBox; // Restore solid
             self.enemy.takedamage = true;
             self.enemy.health = self.enemy.max_health;
             self.enemy.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
             // self.enemy.think = ... (restore think?)
             // This is complex without storing original think.
             // Usually specific monsters have logic to handle resurrection.
             // Or we just heal.
        }

        self.monsterinfo.current_move = fixbot_move_stand;
        self.monsterinfo.aiflags &= ~AIFlags.Medic;
        self.enemy = null;
    }
}

function fixbot_fire_welder(self: Entity, context: EntitySystem): void {
    // Visuals and sounds
    if (context.game.random.frandom() > 0.8) {
        const r = context.game.random.frandom();
        if (r < 0.33) context.engine.sound?.(self, 0, 'misc/welder1.wav', 1, 1, 0);
        else if (r < 0.66) context.engine.sound?.(self, 0, 'misc/welder2.wav', 1, 1, 0);
        else context.engine.sound?.(self, 0, 'misc/welder3.wav', 1, 1, 0);
    }
}

function fixbot_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.timestamp < (self.pain_debounce_time || 0)) return;

    self.pain_debounce_time = self.timestamp + 3;
    context.engine.sound?.(self, 0, 'flyer/flypain1.wav', 1, 1, 0);

    if (damage <= 10) self.monsterinfo.current_move = fixbot_move_pain3;
    else if (damage <= 25) self.monsterinfo.current_move = fixbot_move_painb;
    else self.monsterinfo.current_move = fixbot_move_paina;
}

function fixbot_stand(self: Entity): void {
    self.monsterinfo.current_move = fixbot_move_stand;
}

function fixbot_walk(self: Entity): void {
    self.monsterinfo.current_move = fixbot_move_walk;
}

function fixbot_run(self: Entity): void {
    if (self.monsterinfo.aiflags & AIFlags.StandGround)
        self.monsterinfo.current_move = fixbot_move_stand;
    else
        self.monsterinfo.current_move = fixbot_move_run;
}

function fixbot_start_attack(self: Entity): void {
    self.monsterinfo.current_move = fixbot_move_start_attack;
}

function fixbot_attack(self: Entity): void {
    if (self.monsterinfo.aiflags & AIFlags.Medic) {
        // Laser repair
        self.monsterinfo.current_move = fixbot_move_laserattack;
    } else {
        // Blaster
        self.monsterinfo.current_move = fixbot_move_attack2;
    }
}

function weldstate(self: Entity): void {
    // Logic to loop weld or end it
    if (self.goalentity && self.goalentity.health > 0) { // repairing object_repair?
         // decrement health of object?
         // self.goalentity.health -= 10;
    } else {
        self.monsterinfo.current_move = fixbot_move_stand;
    }
}

// Moves

// STAND
const frames_stand: MonsterFrame[] = Array(19).fill({ ai: monster_ai_move, dist: 0 });
frames_stand[18] = { ai: monster_ai_move, dist: 0, think: fixbot_search }; // Add search to idle
fixbot_move_stand = {
    firstframe: 58, // FRAME_ambient_01
    lastframe: 76,
    frames: frames_stand,
    endfunc: null
};

// WALK
const frames_walk: MonsterFrame[] = [
    { ai: monster_ai_walk, dist: 5 }
];
fixbot_move_walk = {
    firstframe: 0,
    lastframe: 0,
    frames: frames_walk,
    endfunc: null
};

// RUN
const frames_run: MonsterFrame[] = [
    { ai: monster_ai_run, dist: 10 }
];
fixbot_move_run = {
    firstframe: 0,
    lastframe: 0,
    frames: frames_run,
    endfunc: null
};

// ATTACK 2 (Blaster)
const frames_attack2: MonsterFrame[] = Array(31).fill({ ai: monster_ai_charge, dist: 0 });
frames_attack2[20] = { ai: monster_ai_charge, dist: 0, think: fixbot_fire_blaster_func }; // Frame 21
fixbot_move_attack2 = {
    firstframe: 121, // FRAME_charging_01
    lastframe: 151,
    frames: frames_attack2,
    endfunc: fixbot_run
};

// LASER ATTACK (Repair)
const frames_laserattack: MonsterFrame[] = Array(6).fill({ ai: monster_ai_charge, dist: 0, think: fixbot_fire_laser });
fixbot_move_laserattack = {
    firstframe: 115, // FRAME_shoot_01
    lastframe: 120,
    frames: frames_laserattack,
    endfunc: null // Loops or handled by AI?
};

// WELD START
const frames_weld_start: MonsterFrame[] = Array(10).fill({ ai: monster_ai_move, dist: 0 });
frames_weld_start[9] = { ai: monster_ai_move, dist: 0, think: weldstate };
fixbot_move_weld_start = {
    firstframe: 77, // FRAME_weldstart_01
    lastframe: 86,
    frames: frames_weld_start,
    endfunc: null
};

// WELD
const frames_weld: MonsterFrame[] = Array(7).fill({ ai: monster_ai_move, dist: 0, think: fixbot_fire_welder });
frames_weld[6] = { ai: monster_ai_move, dist: 0, think: weldstate };
fixbot_move_weld = {
    firstframe: 87, // FRAME_weldmiddle_01
    lastframe: 93,
    frames: frames_weld,
    endfunc: null
};

// WELD END
const frames_weld_end: MonsterFrame[] = Array(7).fill({ ai: monster_ai_move, dist: -2 });
frames_weld_end[6] = { ai: monster_ai_move, dist: -2, think: weldstate };
fixbot_move_weld_end = {
    firstframe: 94, // FRAME_weldend_01
    lastframe: 100,
    frames: frames_weld_end,
    endfunc: null
};

// START ATTACK
const frames_start_attack: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 }
];
fixbot_move_start_attack = {
    firstframe: 0,
    lastframe: 0,
    frames: frames_start_attack,
    endfunc: fixbot_attack
};

// PAIN 3
const frames_pain3: MonsterFrame[] = [
    { ai: monster_ai_move, dist: -1 }
];
fixbot_move_pain3 = {
    firstframe: 0,
    lastframe: 0,
    frames: frames_pain3,
    endfunc: fixbot_run
};

// PAIN B
const frames_painb: MonsterFrame[] = Array(8).fill({ ai: monster_ai_move, dist: 0 });
fixbot_move_painb = {
    firstframe: 107, // FRAME_painb_01
    lastframe: 114,
    frames: frames_painb,
    endfunc: fixbot_run
};

// PAIN A
const frames_paina: MonsterFrame[] = Array(6).fill({ ai: monster_ai_move, dist: 0 });
fixbot_move_paina = {
    firstframe: 101, // FRAME_paina_01
    lastframe: 106,
    frames: frames_paina,
    endfunc: fixbot_run
};


export function SP_monster_fixbot(self: Entity, context: SpawnContext): void {
    self.classname = 'monster_fixbot';
    self.model = 'models/monsters/fixbot/tris.md2';
    self.mins = { x: -32, y: -32, z: -24 };
    self.maxs = { x: 32, y: 32, z: 24 };
    self.movetype = MoveType.Step; // But flies
    self.solid = Solid.BoundingBox;
    self.health = 150 * context.health_multiplier;
    self.max_health = self.health;
    self.mass = 150;

    self.pain = (e, o, k, d) => fixbot_pain(e, o, k, d, context.entities);
    self.die = (e, i, a, d, p, m) => fixbot_die(e, i, a, d, p, m, context.entities);

    self.monsterinfo.stand = fixbot_stand;
    self.monsterinfo.walk = fixbot_walk;
    self.monsterinfo.run = fixbot_run;
    self.monsterinfo.attack = fixbot_start_attack;
    // self.monsterinfo.search = (s) => fixbot_search(s, context.entities);
    // Not standard property, but we can hook it or use idle?
    // C code has monsterinfo.search = gekk_search; Wait, fixbot_search.
    // I should check if `search` is on MonsterInfo interface.
    // If not, I added it to `frames_stand`.

    context.entities.linkentity(self);

    self.monsterinfo.current_move = fixbot_move_stand;

    // Flight handling
    // flymonster_start(self);
    // Mimic flymonster_start
    self.think = monster_think;
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;
    self.flags |= EntityFlags.Fly; // Not strictly FL_FLY but used for floating
}

export function registerFixbotSpawns(registry: SpawnRegistry): void {
  registry.register('monster_fixbot', SP_monster_fixbot);
}
