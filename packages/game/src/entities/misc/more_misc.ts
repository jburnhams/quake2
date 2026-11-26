import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry, SpawnContext } from '../spawn.js';
import { createRandomGenerator, scaleVec3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';
import { G_PickTarget } from '../utils.js';

// ============================================================================
// FUNC CLOCK
// ============================================================================

const SPAWNFLAG_TIMER_UP = 1;
const SPAWNFLAG_TIMER_DOWN = 2;
const SPAWNFLAG_TIMER_START_OFF = 4;
const SPAWNFLAG_TIMER_MULTI_USE = 8;

function func_clock_reset(self: Entity) {
    self.activator = null;
    if (self.spawnflags & SPAWNFLAG_TIMER_UP) {
        self.health = 0;
        self.wait = self.count; // Use count as target value
    } else if (self.spawnflags & SPAWNFLAG_TIMER_DOWN) {
        self.health = self.count;
        self.wait = 0;
    }
}

function func_clock_format_countdown(self: Entity, message: string): string {
    // Basic formatting based on style
    // Style 0: "xx"
    // Style 1: "xx:xx"
    // Style 2: "xx:xx:xx"
    const h = Math.floor(self.health);
    if (self.style === 0) {
        return `${h}`.padStart(2, ' ');
    }
    if (self.style === 1) {
        const m = Math.floor(h / 60);
        const s = h % 60;
        return `${m}`.padStart(2, ' ') + ':' + `${s}`.padStart(2, '0');
    }
    if (self.style === 2) {
        const hr = Math.floor(h / 3600);
        const m = Math.floor((h % 3600) / 60);
        const s = h % 60;
        return `${hr}`.padStart(2, ' ') + ':' + `${m}`.padStart(2, '0') + ':' + `${s}`.padStart(2, '0');
    }
    return "";
}

function func_clock_think(self: Entity, context: EntitySystem) {
    if (!self.enemy) {
        // self.enemy = G_FindByTargetname(self.target);
        const targets = context.findByTargetName(self.target || "");
        if (targets.length > 0) self.enemy = targets[0];
        if (!self.enemy) return;
    }

    if (self.spawnflags & SPAWNFLAG_TIMER_UP) {
        // Update string
        const msg = func_clock_format_countdown(self, "");
        self.health++;
        self.enemy.message = msg;
        self.enemy.use?.(self.enemy, self, self);
    } else if (self.spawnflags & SPAWNFLAG_TIMER_DOWN) {
        const msg = func_clock_format_countdown(self, "");
        self.health--;
        self.enemy.message = msg;
        self.enemy.use?.(self.enemy, self, self);
    } else {
        // Time of day - unsupported for now in MVP
    }

    if ((self.spawnflags & SPAWNFLAG_TIMER_UP) && (self.health > self.wait) ||
        (self.spawnflags & SPAWNFLAG_TIMER_DOWN) && (self.health < self.wait)) {

        if (self.pathtarget) {
            context.useTargets(self, self.activator);
        }

        if (!(self.spawnflags & SPAWNFLAG_TIMER_MULTI_USE)) {
            return;
        }

        func_clock_reset(self);

        if (self.spawnflags & SPAWNFLAG_TIMER_START_OFF) {
            return;
        }
    }

    self.nextthink = context.timeSeconds + 1.0;
}

function func_clock_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    if (!(self.spawnflags & SPAWNFLAG_TIMER_MULTI_USE)) {
        self.use = undefined;
    }
    if (self.activator) return;
    self.activator = activator;
    func_clock_think(self, context);
}

export function registerFuncClock(registry: SpawnRegistry) {
    registry.register('func_clock', (entity: Entity, context: SpawnContext) => {
        if (!entity.target) {
            context.warn("func_clock with no target");
            context.free(entity);
            return;
        }
        if ((entity.spawnflags & SPAWNFLAG_TIMER_DOWN) && !entity.count) {
            context.warn("func_clock with no count");
            context.free(entity);
            return;
        }
        if ((entity.spawnflags & SPAWNFLAG_TIMER_UP) && !entity.count) {
            entity.count = 60 * 60;
        }

        func_clock_reset(entity);
        entity.think = (self) => func_clock_think(self, context.entities);

        if (entity.spawnflags & SPAWNFLAG_TIMER_START_OFF) {
            entity.use = (self, other, activator) => func_clock_use(self, other, activator ?? null, context.entities);
        } else {
            entity.nextthink = context.entities.timeSeconds + 1.0;
        }
    });
}

// ============================================================================
// TARGET STRING & CHARACTER
// ============================================================================

function target_string_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    if (!self.message) return;

    // Find all team members
    // In Quake 2, teammaster links entities.
    // Here we might need to find by team name or assume system linked them.
    // EntitySystem doesn't automatically link teams like Q2 G_InitEdict.
    // We iterate or rely on some team linkage if implemented.
    // For now, let's search by team.

    // Simplification: iterate entities, if team matches, update frame.
    if (!self.team) return;

    const msg = self.message;
    const len = msg.length;

    context.forEachEntity((e) => {
        if (e.team === self.team && e.classname === 'target_character') {
            if (!e.count) return;
            const n = e.count - 1;
            if (n >= len) {
                e.frame = 12; // Blank?
                return;
            }
            const c = msg.charCodeAt(n);
            if (c >= 48 && c <= 57) { // 0-9
                e.frame = c - 48;
            } else if (msg[n] === '-') {
                e.frame = 10;
            } else if (msg[n] === ':') {
                e.frame = 11;
            } else {
                e.frame = 12;
            }
        }
    });
}

export function registerTargetString(registry: SpawnRegistry) {
    registry.register('target_string', (entity: Entity, context: SpawnContext) => {
        if (!entity.message) entity.message = "";
        entity.use = (self, other, activator) => target_string_use(self, other, activator ?? null, context.entities);
    });
}

export function registerTargetCharacter(registry: SpawnRegistry) {
    registry.register('target_character', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.Push;
        entity.solid = Solid.Bsp;
        entity.frame = 12;
        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC FLARE
// ============================================================================

const SPAWNFLAG_FLARE_RED = 1;
const SPAWNFLAG_FLARE_GREEN = 2;
const SPAWNFLAG_FLARE_BLUE = 4;
const SPAWNFLAG_FLARE_LOCK_ANGLE = 8;

export function registerMiscFlare(registry: SpawnRegistry) {
    registry.register('misc_flare', (entity: Entity, context: SpawnContext) => {
        entity.modelindex = 1;
        entity.renderfx |= 128; // RF_FLARE ? Need constant
        // RF_FLARE is 128 (0x80) from shared/protocol/renderFx.ts

        entity.solid = Solid.Not;
        // entity.scale = st.radius // entity.count or similar? Q2 uses st.radius.
        // Assume mapped to count or scale? Or keyValues.
        // Let's assume parsed into scale if supported, or use frame.

        // Handling renderfx flags
        if (entity.spawnflags & SPAWNFLAG_FLARE_RED) entity.renderfx |= 1024; // RF_SHELL_RED
        if (entity.spawnflags & SPAWNFLAG_FLARE_GREEN) entity.renderfx |= 2048; // RF_SHELL_GREEN
        if (entity.spawnflags & SPAWNFLAG_FLARE_BLUE) entity.renderfx |= 4096; // RF_SHELL_BLUE

        // LOCK_ANGLE ?

        entity.mins = { x: -32, y: -32, z: -32 };
        entity.maxs = { x: 32, y: 32, z: 32 };

        if (entity.targetname) {
            entity.use = (self) => {
                self.svflags ^= ServerFlags.NoClient;
                context.entities.linkentity(self);
            };
        }

        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC HOLOGRAM
// ============================================================================

function misc_hologram_think(self: Entity, context: EntitySystem) {
    self.angles = { ...self.angles, y: self.angles.y + 100 * 0.1 };
    self.nextthink = context.timeSeconds + 0.1;
    self.alpha = 0.2 + (context.rng.frandom() * 0.4);
}

export function registerMiscHologram(registry: SpawnRegistry) {
    registry.register('misc_hologram', (entity: Entity, context: SpawnContext) => {
        entity.solid = Solid.Not;
        entity.modelindex = context.entities.modelIndex("models/ships/strogg1/tris.md2");
        entity.mins = { x: -16, y: -16, z: 0 };
        entity.maxs = { x: 16, y: 16, z: 32 };
        // entity.effects |= EF_HOLOGRAM;
        entity.think = (self) => misc_hologram_think(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;
        entity.alpha = 0.5;
        // entity.scale = 0.75;
        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC FIREBALL
// ============================================================================

const SPAWNFLAG_LAVABALL_NO_EXPLODE = 1;

function fire_touch(self: Entity, other: Entity | null, context: EntitySystem) {
    if (self.spawnflags & SPAWNFLAG_LAVABALL_NO_EXPLODE) {
        context.free(self);
        return;
    }

    // Damage
    if (other && other.takedamage) {
        // T_Damage...
    }

    // BecomeExplosion1
    context.free(self);
}

function fire_fly(self: Entity, context: EntitySystem) {
    const fireball = context.spawn();
    // fireball.effects = EF_FIREBALL;
    // fireball.renderfx = RF_MINLIGHT;
    fireball.solid = Solid.BoundingBox;
    fireball.movetype = MoveType.Toss;
    fireball.clipmask = 1; // MASK_SHOT
    fireball.velocity = {
        x: context.rng.crandom() * 50,
        y: context.rng.crandom() * 50,
        z: (self.speed || 185) * 1.75 + (context.rng.frandom() * 200)
    };
    fireball.classname = "fireball";
    fireball.modelindex = context.modelIndex("models/objects/gibs/sm_meat/tris.md2");
    fireball.origin = { ...self.origin };
    fireball.touch = (s, o) => fire_touch(s, o, context);
    fireball.spawnflags = self.spawnflags;

    fireball.think = (ent) => context.free(ent);
    fireball.nextthink = context.timeSeconds + 5.0;

    context.linkentity(fireball);

    self.nextthink = context.timeSeconds + (context.rng.frandom() * 5.0);
}

export function registerMiscFireball(registry: SpawnRegistry) {
    registry.register('misc_fireball', (entity: Entity, context: SpawnContext) => {
        // SP_misc_lavaball
        entity.classname = "fireball"; // Actually spawner stays? No, SP_misc_lavaball sets classname to fireball but acts as spawner?
        // Wait, SP_misc_lavaball makes the entity the spawner.
        entity.think = (self) => fire_fly(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + (context.entities.rng.frandom() * 5.0);
        if (!entity.speed) entity.speed = 185;
    });
    // Alias misc_lavaball
    registry.register('misc_lavaball', registry.get('misc_fireball')!);
}

// ============================================================================
// INFO LANDMARK & WORLD TEXT
// ============================================================================

export function registerInfoLandmark(registry: SpawnRegistry) {
    registry.register('info_landmark', (entity: Entity, context: SpawnContext) => {
        entity.absmin = { ...entity.origin };
        entity.absmax = { ...entity.origin };
    });
}

function info_world_text_think(self: Entity, context: EntitySystem) {
    // Draw text logic?
    // Requires client-side support or temp entity TE_WORLD_TEXT?
    // If not supported, just do nothing.
    self.nextthink = context.timeSeconds + 0.1;
}

export function registerInfoWorldText(registry: SpawnRegistry) {
    registry.register('info_world_text', (entity: Entity, context: SpawnContext) => {
        if (!entity.message) {
            context.free(entity);
            return;
        }
        // entity.think = ...
        // entity.use = ...
    });
}

export function registerMiscPlayerMannequin(registry: SpawnRegistry) {
    registry.register('misc_player_mannequin', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.BoundingBox;
        entity.modelindex = 255; // Player
        entity.mins = { x: -16, y: -16, z: -24 };
        entity.maxs = { x: 16, y: 16, z: 32 };
        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC MODEL
// ============================================================================

export function registerMiscModel(registry: SpawnRegistry) {
    registry.register('misc_model', (entity: Entity, context: SpawnContext) => {
        if (!entity.model) {
            context.warn(`${entity.classname} with no model`);
            context.free(entity);
            return;
        }
        entity.modelindex = context.entities.modelIndex(entity.model);
        context.entities.linkentity(entity);
    });
}
