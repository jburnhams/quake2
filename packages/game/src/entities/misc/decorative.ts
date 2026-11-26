import { Entity, MoveType, Solid, ServerFlags, EntityEffects } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry, SpawnContext } from '../spawn.js';
import { createRandomGenerator, RenderFx } from '@quake2ts/shared';

const random = createRandomGenerator();

// ============================================================================
// MISC SATELLITE DISH
// ============================================================================

function misc_satellite_dish_think(self: Entity, context: EntitySystem) {
    self.frame++;
    if (self.frame < 38) {
        self.nextthink = context.timeSeconds + 0.1;
    }
}

function misc_satellite_dish_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    self.frame = 0;
    self.think = (ent) => misc_satellite_dish_think(ent, context);
    self.nextthink = context.timeSeconds + 0.1;
}

export function registerMiscSatelliteDish(registry: SpawnRegistry) {
    registry.register('misc_satellite_dish', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.BoundingBox;
        entity.mins = { x: -64, y: -64, z: 0 };
        entity.maxs = { x: 64, y: 64, z: 128 };
        entity.modelindex = context.entities.modelIndex("models/objects/satellite/tris.md2");
        entity.use = (self, other, activator) => misc_satellite_dish_use(self, other, activator ?? null, context.entities);
        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC BLACKHOLE
// ============================================================================

const SPAWNFLAG_BLACKHOLE_AUTO_NOISE = 1;

function misc_blackhole_think(self: Entity, context: EntitySystem) {
    if (self.timestamp <= context.timeSeconds) {
        self.frame++;
        if (self.frame >= 19) self.frame = 0;
        self.timestamp = context.timeSeconds + 0.1;
    }

    if (self.spawnflags & SPAWNFLAG_BLACKHOLE_AUTO_NOISE) {
        self.angles = {
            x: self.angles.x + 50 * 0.1,
            y: self.angles.y + 50 * 0.1,
            z: self.angles.z
        };
    }

    self.nextthink = context.timeSeconds + 0.01; // FRAME_TIME_MS (approx 100fps in think?)
    // Original uses FRAME_TIME_MS which is usually 0.1 or 0.05?
    // G_RunFrame calls RunEntity thinks.
    // If we want smooth rotation, we need small interval.
}

function misc_blackhole_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    context.free(self);
}

export function registerMiscBlackhole(registry: SpawnRegistry) {
    registry.register('misc_blackhole', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.Not;
        entity.mins = { x: -64, y: -64, z: 0 };
        entity.maxs = { x: 64, y: 64, z: 8 };
        entity.modelindex = context.entities.modelIndex("models/objects/black/tris.md2");
        entity.renderfx |= RenderFx.Translucent; // RF_TRANSLUCENT

        entity.use = (self, other, activator) => misc_blackhole_use(self, other, activator ?? null, context.entities);
        entity.think = (self) => misc_blackhole_think(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1; // 20_hz

        if (entity.spawnflags & SPAWNFLAG_BLACKHOLE_AUTO_NOISE) {
            // entity.s.sound = ... "world/blackhole.wav"
            // entity.s.loop_attenuation = ATTN_NORM
        }

        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC EASTER
// ============================================================================

function misc_eastertank_think(self: Entity, context: EntitySystem) {
    self.frame++;
    if (self.frame < 293) {
        self.nextthink = context.timeSeconds + 0.1;
    } else {
        self.frame = 254;
        self.nextthink = context.timeSeconds + 0.1;
    }
}

export function registerMiscEasterTank(registry: SpawnRegistry) {
    registry.register('misc_eastertank', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.BoundingBox;
        entity.mins = { x: -32, y: -32, z: -16 };
        entity.maxs = { x: 32, y: 32, z: 32 };
        entity.modelindex = context.entities.modelIndex("models/monsters/tank/tris.md2");
        entity.frame = 254;
        entity.think = (self) => misc_eastertank_think(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;
        context.entities.linkentity(entity);
    });
}

function misc_easterchick_think(self: Entity, context: EntitySystem) {
    self.frame++;
    if (self.frame < 247) {
        self.nextthink = context.timeSeconds + 0.1;
    } else {
        self.frame = 208;
        self.nextthink = context.timeSeconds + 0.1;
    }
}

export function registerMiscEasterChick(registry: SpawnRegistry) {
    registry.register('misc_easterchick', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.BoundingBox;
        entity.mins = { x: -32, y: -32, z: 0 };
        entity.maxs = { x: 32, y: 32, z: 32 };
        entity.modelindex = context.entities.modelIndex("models/monsters/bitch/tris.md2");
        entity.frame = 208;
        entity.think = (self) => misc_easterchick_think(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;
        context.entities.linkentity(entity);
    });
}

function misc_easterchick2_think(self: Entity, context: EntitySystem) {
    self.frame++;
    if (self.frame < 287) {
        self.nextthink = context.timeSeconds + 0.1;
    } else {
        self.frame = 248;
        self.nextthink = context.timeSeconds + 0.1;
    }
}

export function registerMiscEasterChick2(registry: SpawnRegistry) {
    registry.register('misc_easterchick2', (entity: Entity, context: SpawnContext) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.BoundingBox;
        entity.mins = { x: -32, y: -32, z: 0 };
        entity.maxs = { x: 32, y: 32, z: 32 };
        entity.modelindex = context.entities.modelIndex("models/monsters/bitch/tris.md2");
        entity.frame = 248;
        entity.think = (self) => misc_easterchick2_think(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;
        context.entities.linkentity(entity);
    });
}
