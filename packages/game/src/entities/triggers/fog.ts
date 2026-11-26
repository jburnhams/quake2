import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { scaleVec3, normalizeVec3, subtractVec3, addVec3, lengthVec3 } from '@quake2ts/shared';
import { G_PickTarget } from '../utils.js';

// Helper functions for clamp and lerp if not available in shared
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

const SPAWNFLAG_FOG_AFFECT_FOG = 1;
const SPAWNFLAG_FOG_AFFECT_HEIGHTFOG = 2;
const SPAWNFLAG_FOG_INSTANTANEOUS = 4;
const SPAWNFLAG_FOG_FORCE = 8;
const SPAWNFLAG_FOG_BLEND = 16;

function trigger_fog_touch(self: Entity, other: Entity | null, context: EntitySystem) {
    if (!other || !other.client) return;

    if (self.timestamp > context.timeSeconds) return;

    // Default wait is 0, so usually this is always ready unless wait is set
    self.timestamp = context.timeSeconds + (self.wait || 0);

    let fog_value_storage: Entity = self;

    if (self.movetarget) {
        fog_value_storage = self.movetarget;
    }

    if (self.spawnflags & SPAWNFLAG_FOG_INSTANTANEOUS) {
        if (other.client.pers) other.client.pers.fog_transition_time = 0;
    } else {
        if (other.client.pers) other.client.pers.fog_transition_time = fog_value_storage.delay || 0.5;
    }

    if (self.spawnflags & SPAWNFLAG_FOG_BLEND) {
        // Blend logic
        // vec3_t center = (self->absmin + self->absmax) * 0.5f;
        const center = scaleVec3(addVec3(self.absmin, self.absmax), 0.5);

        // vec3_t half_size = (self->size * 0.5f) + (other->size * 0.5f);
        const half_size = addVec3(scaleVec3(self.size, 0.5), scaleVec3(other.size, 0.5));

        // vec3_t start = (-self->movedir).scaled(half_size);
        const start = {
            x: -self.movedir.x * half_size.x,
            y: -self.movedir.y * half_size.y,
            z: -self.movedir.z * half_size.z
        };

        // vec3_t end = (self->movedir).scaled(half_size);
        const end = {
            x: self.movedir.x * half_size.x,
            y: self.movedir.y * half_size.y,
            z: self.movedir.z * half_size.z
        };

        // vec3_t player_dist = (other->s.origin - center).scaled(vec3_t{fabs(self->movedir[0]),fabs(self->movedir[1]),fabs(self->movedir[2])});
        const delta = subtractVec3(other.origin, center);
        const absMovedir = {
            x: Math.abs(self.movedir.x),
            y: Math.abs(self.movedir.y),
            z: Math.abs(self.movedir.z)
        };
        const player_dist = {
            x: delta.x * absMovedir.x,
            y: delta.y * absMovedir.y,
            z: delta.z * absMovedir.z
        };

        let dist = lengthVec3(subtractVec3(player_dist, start));
        dist /= lengthVec3(subtractVec3(start, end));
        dist = clamp(dist, 0, 1);

        if (self.spawnflags & SPAWNFLAG_FOG_AFFECT_FOG) {
            // Apply fog blend
            const storage = fog_value_storage as any;

            if (other.client.pers) {
                other.client.pers.wanted_fog = {
                    density: lerp(storage.fog_density_off || 0, storage.fog_density || 0, dist),
                    r: lerp(storage.fog_color_off?.[0] || 0, storage.fog_color?.[0] || 0, dist),
                    g: lerp(storage.fog_color_off?.[1] || 0, storage.fog_color?.[1] || 0, dist),
                    b: lerp(storage.fog_color_off?.[2] || 0, storage.fog_color?.[2] || 0, dist),
                    sky_factor: lerp(storage.fog_sky_factor_off || 0, storage.fog_sky_factor || 0, dist)
                };
            }
        }

        return;
    }

    let use_on = true;

    if (!(self.spawnflags & SPAWNFLAG_FOG_FORCE)) {
        const len = lengthVec3(other.velocity);
        if (len <= 0.0001) return;

        const forward = normalizeVec3(other.velocity);
        // dot product
        const dot = forward.x * self.movedir.x + forward.y * self.movedir.y + forward.z * self.movedir.z;
        use_on = dot > 0;
    }

    const storage = fog_value_storage as any;

    if (self.spawnflags & SPAWNFLAG_FOG_AFFECT_FOG) {
        if (other.client.pers) {
            if (use_on) {
                other.client.pers.wanted_fog = {
                    density: storage.fog_density || 0,
                    r: storage.fog_color?.[0] || 0,
                    g: storage.fog_color?.[1] || 0,
                    b: storage.fog_color?.[2] || 0,
                    sky_factor: storage.fog_sky_factor || 0
                };
            } else {
                other.client.pers.wanted_fog = {
                    density: storage.fog_density_off || 0,
                    r: storage.fog_color_off?.[0] || 0,
                    g: storage.fog_color_off?.[1] || 0,
                    b: storage.fog_color_off?.[2] || 0,
                    sky_factor: storage.fog_sky_factor_off || 0
                };
            }
        }
    }
}

export function registerTriggerFog(registry: any) {
    registry.register('trigger_fog', (entity: Entity, context: any) => {
        // InitTrigger logic (solid trigger, movetype none)
        entity.solid = Solid.Trigger;
        entity.movetype = MoveType.None;
        entity.svflags |= ServerFlags.NoClient;

        // Parse fog keys manually from context.keyValues
        const entAny = entity as any;
        const kv = context.keyValues;

        entAny.fog_density = parseFloat(kv.fog_density) || 0;
        entAny.fog_color = kv.fog_color ? kv.fog_color.split(' ').map(parseFloat) : [0,0,0];
        entAny.fog_sky_factor = parseFloat(kv.fog_sky_factor) || 0;

        entAny.fog_density_off = parseFloat(kv.fog_density_off) || 0;
        entAny.fog_color_off = kv.fog_color_off ? kv.fog_color_off.split(' ').map(parseFloat) : [0,0,0];
        entAny.fog_sky_factor_off = parseFloat(kv.fog_sky_factor_off) || 0;

        if (entity.target) {
            entity.movetype = MoveType.None;
            entity.movetarget = null;
        }

        if (!entity.delay) entity.delay = 0.5;

        entity.touch = (self, other) => trigger_fog_touch(self, other, context.entities);
    });
}
