import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { normalizeVec3, scaleVec3, subtractVec3, addVec3, distance } from '@quake2ts/shared';
import { G_PickTarget } from '../utils.js';

// ============================================================================
// MISC VIPER
// ============================================================================

const train_use = (self: Entity, other: Entity | null, activator: Entity | null | undefined, context: EntitySystem) => {
    if (self.velocity.x !== 0 || self.velocity.y !== 0 || self.velocity.z !== 0) return;

    // Resume
    if (self.target_ent) {
        // Need access to train_wait or logic from func_train
        // Since we can't easily import train_wait from funcs.ts (it's internal), we need to duplicate or export it.
        // For MVP, we'll reimplement basic train movement logic here or export it.
        // Assuming we will refactor funcs.ts later to export train logic.

        // Let's implement basic movement to target.
        const next = self.target_ent;
        const dist = distance(self.origin, next.origin);
        // Viper uses moveinfo.speed
        const speed = self.moveinfo?.speed || 300;
        const time = dist / speed;
        const dir = normalizeVec3(subtractVec3(next.origin, self.origin));
        self.velocity = scaleVec3(dir, speed);
        self.think = (ent) => train_next(ent, context);
        context.scheduleThink(self, context.timeSeconds + time);
    }
}

const train_next = (self: Entity, context: EntitySystem) => {
    self.velocity = { x: 0, y: 0, z: 0 };
    if (self.target_ent) {
        self.origin = { ...self.target_ent.origin };
        // Fire pathtarget
        if (self.target_ent.pathtarget) {
            context.useTargets(self.target_ent, self);
        }

        if (self.target_ent.target) {
            const next = G_PickTarget(self.target_ent.target, context);
            if (next) {
                self.target_ent = next;

                if (self.target_ent.wait) {
                    self.think = (ent) => train_use(ent, null, null, context);
                    context.scheduleThink(self, context.timeSeconds + self.target_ent.wait);
                } else {
                    train_use(self, null, null, context);
                }
            }
        }
    }
}

const func_train_find = (self: Entity, context: EntitySystem) => {
    const target = G_PickTarget(self.target, context);
    if (!target) return;
    self.target_ent = target;
    self.origin = { ...target.origin };

    context.linkentity(self);
}

export function registerMiscViper(registry: SpawnRegistry) {
    registry.register('misc_viper', (entity: Entity, context: any) => {
        if (!entity.target) {
            context.warn(`${entity.classname} without a target`);
            context.free(entity);
            return;
        }

        if (!entity.speed) entity.speed = 300;

        entity.movetype = MoveType.Push;
        entity.solid = Solid.Not;
        entity.modelindex = context.entities.modelIndex("models/ships/viper/tris.md2");
        entity.mins = { x: -16, y: -16, z: 0 };
        entity.maxs = { x: 16, y: 16, z: 32 };

        entity.think = (self) => func_train_find(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;

        entity.use = (self, other, activator) => {
            self.svflags &= ~ServerFlags.NoClient;
            train_use(self, other, activator, context.entities);
        };

        entity.svflags |= ServerFlags.NoClient;
        if (!entity.moveinfo) entity.moveinfo = {};
        entity.moveinfo.speed = entity.speed;
        entity.moveinfo.accel = entity.speed;
        entity.moveinfo.decel = entity.speed;

        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC STROGG SHIP
// ============================================================================

const misc_strogg_ship_use = (self: Entity, other: Entity | null, activator: Entity | null | undefined, context: EntitySystem) => {
    self.svflags &= ~ServerFlags.NoClient;
    self.use = (ent, oth, act) => train_use(ent, oth, act, context);
    train_use(self, other, activator, context);
}

export function registerMiscStroggShip(registry: SpawnRegistry) {
    registry.register('misc_strogg_ship', (entity: Entity, context: any) => {
        if (!entity.target) {
            context.warn(`${entity.classname} without a target`);
            context.free(entity);
            return;
        }

        if (!entity.speed) entity.speed = 300;

        entity.movetype = MoveType.Push;
        entity.solid = Solid.Not;
        entity.modelindex = context.entities.modelIndex("models/ships/strogg1/tris.md2");
        entity.mins = { x: -16, y: -16, z: 0 };
        entity.maxs = { x: 16, y: 16, z: 32 };

        entity.think = (self) => func_train_find(self, context.entities);
        entity.nextthink = context.entities.timeSeconds + 0.1;

        entity.use = (self, other, activator) => misc_strogg_ship_use(self, other, activator, context.entities);

        entity.svflags |= ServerFlags.NoClient;
        if (!entity.moveinfo) entity.moveinfo = {};
        entity.moveinfo.speed = entity.speed;
        entity.moveinfo.accel = entity.speed;
        entity.moveinfo.decel = entity.speed;

        context.entities.linkentity(entity);
    });
}

// ============================================================================
// MISC VIPER BOMB
// ============================================================================

function misc_viper_bomb_touch(self: Entity, other: Entity | null, context: EntitySystem) {
    context.useTargets(self, self.activator || null);

    self.origin = { ...self.origin, z: self.absmin.z + 1 };
    // Radius damage
    // T_RadiusDamage...
    // BecomeExplosion2...
    context.free(self); // Placeholder
}

function misc_viper_bomb_prethink(self: Entity, context: EntitySystem) {
    self.groundentity = null;

    // float diff = (self->timestamp - level.time);
    const diff = (self.timestamp - context.timeSeconds);
    const clampDiff = diff < -1.0 ? -1.0 : diff;

    // vec3_t v = self->moveinfo.dir * (1.0f + diff);
    // v[2] = diff;
    // self->s.angles = vectoangles(v);

    self.nextthink = context.timeSeconds + 0.1; // runFrame logic usually handles prethink every frame
}

function misc_viper_bomb_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    let viper: Entity | null = null;
    // Find viper
    context.forEachEntity((ent) => {
        if (ent.classname === 'misc_viper') viper = ent;
    });

    // Cast to any to access moveinfo if strict checking is on
    const v = viper as any;
    if (v && v.moveinfo && v.moveinfo.dir) {
        self.velocity = scaleVec3(v.moveinfo.dir, v.moveinfo.speed || 0);
        self.moveinfo = { dir: { ...v.moveinfo.dir } };
    }

    self.solid = Solid.BoundingBox;
    self.svflags &= ~ServerFlags.NoClient;
    // self.effects |= EF_ROCKET;
    self.use = undefined;
    self.movetype = MoveType.Toss;

    // Prethink simulation via think for now? Or hook into system prethink?
    // entity.ts doesn't have prethink.
    // We'll use think with 0.1 delay or similar.
    self.think = (ent) => misc_viper_bomb_prethink(ent, context);
    self.nextthink = context.timeSeconds + 0.1;

    self.touch = (s, o) => misc_viper_bomb_touch(s, o, context);
    self.activator = activator;
    self.timestamp = context.timeSeconds;
}

export function registerMiscViperBomb(registry: SpawnRegistry) {
    registry.register('misc_viper_bomb', (entity: Entity, context: any) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.Not;
        entity.mins = { x: -8, y: -8, z: -8 };
        entity.maxs = { x: 8, y: 8, z: 8 };
        entity.modelindex = context.entities.modelIndex("models/objects/bomb/tris.md2");

        if (!entity.dmg) entity.dmg = 1000;

        entity.use = (self, other, activator) => misc_viper_bomb_use(self, other, activator ?? null, context.entities);
        entity.svflags |= ServerFlags.NoClient;

        context.entities.linkentity(entity);
    });
}
