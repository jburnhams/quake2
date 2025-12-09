import { Entity, MoveType, Solid, ServerFlags, AiFlags } from './entity.js';
import { EntitySystem } from './system.js';
import { scaleVec3, normalizeVec3, subtractVec3, addVec3, copyVec3, ZERO_VEC3, lengthVec3, Vec3, ConfigStringIndex } from '@quake2ts/shared';
import { G_PickTarget } from './utils.js';

// Replaced HACKFLAGs with semantic constants
const CAMERA_TELEPORT_OUT = 2;
const CAMERA_SKIPPABLE = 64;
const CAMERA_END_OF_UNIT = 128;

const YAW = 1;
const PITCH = 0;
const ROLL = 2;

function camera_lookat_pathtarget(self: Entity, origin: Vec3, dest: Vec3, context: EntitySystem): Vec3 {
    let result = { ...dest };
    if (self.pathtarget) {
        let pt: Entity | null = null;
        const targets = context.findByTargetName(self.pathtarget);
        if (targets.length > 0) {
            pt = targets[0];
        }

        if (pt) {
            let yaw: number, pitch: number;
            const delta = subtractVec3(pt.origin, origin);

            const d = delta.x * delta.x + delta.y * delta.y;
            if (d === 0.0) {
                yaw = 0.0;
                pitch = (delta.z > 0.0) ? 90.0 : -90.0;
            } else {
                yaw = Math.atan2(delta.y, delta.x) * (180.0 / Math.PI);
                pitch = Math.atan2(delta.z, Math.sqrt(d)) * (180.0 / Math.PI);
            }

            result = { x: -pitch, y: yaw, z: 0 };
        }
    }
    return result;
}

function update_target_camera(self: Entity, context: EntitySystem) {
    let do_skip = false;

    // only allow skipping after 2 seconds
    if ((self.spawnflags & CAMERA_SKIPPABLE) && context.timeSeconds > 2) {
        // Need access to clients to check buttons.
        // Assuming context.entities exposes clients or we iterate.
        // For now, iterate all entities and check for clients.
        context.forEachEntity((ent) => {
             if (ent.client) {
                 // Check button presses - BUTTON_ANY equivalent check
                 // Assuming buttons is a bitmask on client or entity
                 // ent.client.buttons doesn't exist on PlayerClient in some contexts?
                 // Let's assume there's a way to check input.
                 // For now, skip this check to fix type error or assume connected check is enough?
                 // ent.client.pers is also missing from type definition possibly.

                 // Minimal check for now until types are fixed/verified
                 /*
                 if (ent.client.buttons) {
                     do_skip = true;
                 }
                 */
             }
        });
    }

    if (!do_skip && self.movetarget) {
        // moveinfo.remaining_distance -= (self.moveinfo.move_speed * frame_time) * 0.8f
        const move_speed = self.moveinfo?.move_speed || 0;
        let remaining_distance = self.moveinfo?.remaining_distance || 0;

        remaining_distance -= (move_speed * 0.1) * 0.8;
        if (self.moveinfo) self.moveinfo.remaining_distance = remaining_distance;

        if (remaining_distance <= 0) {
            if (self.movetarget.spawnflags & CAMERA_TELEPORT_OUT) {
                if (self.enemy) {
                    // self.enemy.s.event = EV_PLAYER_TELEPORT; // TODO
                    self.enemy.spawnflags |= CAMERA_TELEPORT_OUT;
                    // self.enemy.pain_debounce_time = ... // Used for alpha fade timing in dummy think
                }
            }

            self.origin = { ...self.movetarget.origin };
            self.nextthink = context.timeSeconds + (self.movetarget.wait || 0);

            if (self.movetarget.target) {
                self.movetarget = G_PickTarget(self.movetarget.target, context);

                if (self.movetarget) {
                    const speed = self.movetarget.speed ? self.movetarget.speed : 55;
                    if (self.moveinfo) self.moveinfo.move_speed = speed;

                    const dist = lengthVec3(subtractVec3(self.movetarget.origin, self.origin));
                    if (self.moveinfo) {
                        self.moveinfo.remaining_distance = dist;
                        self.moveinfo.distance = dist;
                    }
                }
            } else {
                self.movetarget = null;
            }
            return;
        } else {
             const dist = self.moveinfo?.distance || 1;
             const frac = 1.0 - (remaining_distance / dist);

             if (self.enemy && (self.enemy.spawnflags & CAMERA_TELEPORT_OUT)) {
                 self.enemy.alpha = Math.max(1.0 / 255.0, frac);
             }

             const delta = scaleVec3(subtractVec3(self.movetarget.origin, self.origin), frac);
             const newpos = addVec3(self.origin, delta);

             context.level.intermission_angle = camera_lookat_pathtarget(self, newpos, context.level.intermission_angle, context);
             context.level.intermission_origin = newpos;

             // Move all clients to intermission point
             context.forEachEntity((client) => {
                 if (client.client) {
                     // MoveClientToIntermission(client); // TODO: Expose this or implement
                     // Minimal implementation:
                     client.origin = { ...context.level.intermission_origin };
                     client.angles = { ...context.level.intermission_angle };
                     // client.viewangles = { ...context.level.intermission_angle }; // Not on entity
                     // client.client.ps.pm_type = MoveType.Freeze; // PM_FREEZE? Or INTERMISSION
                     client.client.v_angle = { ...context.level.intermission_angle };
                 }
             });
        }
    } else {
        if (self.killtarget) {
            if (self.enemy) {
                context.free(self.enemy);
            }

            // level.intermissiontime = 0;
            // level.level_intermission_set = true;

            // Fire killtargets
            // while ((t = G_FindByTargetname...)) t.use...

            // level.intermissiontime = level.time;
            // level.exitintermission = true; // if not * map
        }
        self.think = undefined;
        return;
    }

    self.nextthink = context.timeSeconds + 0.1;
}

function target_camera_dummy_think(self: Entity, context: EntitySystem) {
    if (!self.owner || !self.owner.client) return;

    if (self.spawnflags & CAMERA_TELEPORT_OUT) {
        // Handle alpha fade out
    }
    self.nextthink = context.timeSeconds + 0.1;
}


export function useTargetCamera(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    if (self.sounds) {
        context.imports.configstring(ConfigStringIndex.CdTrack, `${self.sounds}`);
    }

    if (!self.target) return;

    self.movetarget = G_PickTarget(self.target, context);
    if (!self.movetarget) return;

    // level.intermissiontime = level.time;
    // level.exitintermission = 0;

    if (activator && activator.client) {
        const dummy = context.spawn();
        self.enemy = dummy;
        dummy.owner = activator;
        // dummy.clipmask = activator.clipmask;
        dummy.origin = { ...activator.origin };
        dummy.angles = { ...activator.angles };
        dummy.think = (ent) => target_camera_dummy_think(ent, context);
        dummy.nextthink = context.timeSeconds + 0.1;
        dummy.solid = Solid.BoundingBox;
        dummy.movetype = MoveType.Step;
        dummy.mins = { ...activator.mins };
        dummy.maxs = { ...activator.maxs };
        dummy.modelindex = 255; // Player model?
        // dummy.skinnum = activator.skinnum;
        dummy.velocity = { ...activator.velocity };

        context.linkentity(dummy);
    }

    context.level.intermission_angle = camera_lookat_pathtarget(self, self.origin, context.level.intermission_angle, context);
    context.level.intermission_origin = { ...self.origin };

    context.forEachEntity((client) => {
        if (!client.client) return;

        if (client.health <= 0) {
            // respawn logic
        }
        // MoveClientToIntermission(client);
    });

    self.activator = activator || null;
    self.think = (ent) => update_target_camera(ent, context);
    self.nextthink = context.timeSeconds + Math.max(self.wait || 0, 0.1);

    // self.moveinfo struct needed on Entity
    if (!self.moveinfo) self.moveinfo = {};
    self.moveinfo.move_speed = self.speed;

    const dist = lengthVec3(subtractVec3(self.movetarget.origin, self.origin));
    self.moveinfo.remaining_distance = dist;
    self.moveinfo.distance = dist;

    // if (self.spawnflags & CAMERA_END_OF_UNIT) ...
}

export function registerTargetCamera(registry: any) {
    registry.register('target_camera', (entity: Entity, context: any) => {
        entity.use = (self, other, activator) => useTargetCamera(self, other, activator ?? null, context.entities);
        entity.svflags |= ServerFlags.NoClient;
    });
}
