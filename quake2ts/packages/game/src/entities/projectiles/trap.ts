
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../entity.js';
import { EntitySystem } from '../system.js';
import { GameExports } from '../../index.js';
import { T_Damage, T_RadiusDamage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { MASK_SOLID, MASK_PROJECTILE, CONTENTS_PLAYER, CONTENTS_DEADMONSTER, CONTENTS_MONSTER } from '@quake2ts/shared';
import { createFoodCubePickupEntity } from '../items/foodcube.js';
import { ServerCommand, ZERO_VEC3, copyVec3, subtractVec3, normalizeVec3, addVec3, scaleVec3, dotVec3, distance, Vec3 } from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';
import { Damageable } from '../../combat/damage.js';

// Math helpers
function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

// From original source
const TRAP_TIMER = 30.0; // 30 seconds life
const EF_TRAP = 0x00000040; // Approx or locally defined if needed.
const EF_ROTATE = 0x00000004; // Standard Q2

export function trapGibThink(self: Entity, context: EntitySystem) {
    if (!self.owner || !self.owner.inUse || self.owner.frame !== 5) {
        context.free(self);
        return;
    }

    const owner = self.owner;

    // Simplified: Pull towards trap center.
    const diff = subtractVec3(owner.origin, self.origin);
    const dist = Math.sqrt(dotVec3(diff, diff));

    if (dist > 10) {
        const dir = normalizeVec3(diff);
        const move = scaleVec3(dir, 15.0 * 0.1); // 15 speed * 0.1 delta
        self.origin = addVec3(self.origin, move);
    }

    // Rotate visuals
    const angles = copyVec3(self.angles);
    self.angles = { ...angles, y: angles.y + 15.0 };

    self.nextthink = context.timeSeconds + 0.1;
}

function trapDie(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod) {
    // We need to set a think function that will run immediately/soon to free the entity.
    // The context isn't passed directly to Die, so we rely on the scheduler running 'think'.
    self.think = (ent: Entity, ctx: EntitySystem) => {
        // Explode
         const game = ctx.engine as unknown as GameExports; // Access engine

         // Trigger explosion effect
         // BecomeExplosion1(ent); -> T_RadiusDamage + visual
         const dmg = 200; // Original Trap explosion damage?
         // "Cause explosion damage???" in source comments.
         // Let's do a standard radius damage.
         T_RadiusDamage([ent] as unknown as Damageable[], ent as unknown as Damageable, ent.owner as unknown as Damageable, dmg, ent as unknown as Damageable, 120, DamageFlags.NONE, DamageMod.TRAP, ctx.timeSeconds, {}, game.multicast);

         // Visual
         // game.multicast...

         ctx.free(ent);
    };
    // Set nextthink to a small positive value so it runs in the next frame cycle.
    // 0 disables think in Quake 2 logic (and likely in this engine's thinkScheduler).
    // Use a small epsilon.
    self.nextthink = self.nextthink + 0.05; // Schedule very soon.
    // Or we can assume 'time' is available if we import `game` singleton, but safer to just delay.
}

export function trapThink(self: Entity, context: EntitySystem) {
    const game = context.engine as unknown as GameExports;
    const time = context.timeSeconds;

    if (self.timestamp < time) {
        // Time out
        context.free(self);
        return;
    }

    self.nextthink = time + 0.1;

    // Ground check
    if (!self.groundentity) {
        return;
    }

    // Animation state machine

    // Deployed and waiting/hunting
    if (self.frame > 4) {
         // Frame 5: Active sucking/eating
         if (self.frame === 5) {
             const spawn = self.wait === 64;
             self.wait -= 2;

             if (spawn) {
                 game.sound?.(self, 0, 'weapons/trapdown.wav', 1, 0, 0); // ATTN_IDLE
             }

             self.delay += 2.0;

             if (self.wait < 19) {
                 self.frame++;
             }
             return;
         }

         // Frame 6-8: Dying/Spawning
         self.frame++;
         if (self.frame === 8) {
             // Spawn food cube
             const food = context.spawn();
             Object.assign(food, createFoodCubePickupEntity(game));
             food.origin = copyVec3(self.origin);
             food.origin = { ...food.origin, z: food.origin.z + 24 };
             food.count = self.mass; // Transfer mass/health amount

             // Velocity up
             food.velocity = { x: 0, y: 0, z: 400 };

             context.linkentity(food);

             game.sound?.(food, 0, 'misc/fhit3.wav', 1, 1, 0);

             context.free(self);
             return;
         }
         return;
    }

    // Frames 0-4: Deploying
    // self.s.effects &= ~EF_TRAP;
    if (self.frame >= 4) {
        // self.s.effects |= EF_TRAP;
        if (game.deathmatch) {
            self.owner = null;
        }
    }

    if (self.frame < 4) {
        self.frame++;
        return;
    }

    // Hunt for targets
    const targets: Entity[] = [];
    context.forEachEntity((ent) => {
        if (ent === self) return;
        if (!ent.inUse) return;

        // Distance check
        const d = subtractVec3(ent.origin, self.origin);
        if (Math.sqrt(dotVec3(d, d)) > 256) return;

        // Validity checks
        if (game.deathmatch) {
             // Logic to avoid teleporters/flags etc.
        }

        if (ent.health <= 0) return;
        if (!ent.takedamage) return;

        targets.push(ent);
    });

    // Find best target
    let best: Entity | null = null;
    let oldlen = 8000;

    for (const t of targets) {
        const d = subtractVec3(self.origin, t.origin);
        const len = Math.sqrt(dotVec3(d, d));

        if (len < oldlen) {
            best = t;
            oldlen = len;
        }
    }

    // Pull enemy in
    if (best) {
        // Lift off ground
        if (best.groundentity) {
            best.origin = { ...best.origin, z: best.origin.z + 1 };
            best.groundentity = null;
        }

        const vec = subtractVec3(self.origin, best.origin);
        const len = Math.sqrt(dotVec3(vec, vec));
        const dir = normalizeVec3(vec);

        const maxSpeed = (best.client) ? 290.0 : 150.0;
        const pull = clamp(maxSpeed - len, 64.0, maxSpeed);

        // best.velocity += dir * pull
        best.velocity = addVec3(best.velocity, scaleVec3(dir, pull));

        // Sound
        game.sound?.(self, 0, 'weapons/trapsuck.wav', 1, 1, 0);

        if (len < 48) {
            // Eat it!

            // Kill logic
            self.takedamage = false;
            self.solid = Solid.Not;
            self.die = undefined;

            // Damage(best, ent, ent.teammaster, 100000...)
            T_Damage(best as unknown as Damageable, self as unknown as Damageable, (self.owner || self) as unknown as Damageable, ZERO_VEC3, best.origin, ZERO_VEC3, 100000, 1, DamageFlags.ENERGY, DamageMod.TRAP, time, game.multicast);

            // M_ProcessPain(best); // If monster

            self.enemy = best;
            self.wait = 64;
            self.timestamp = context.timeSeconds + 30.0;
            self.mass = (game.deathmatch) ? (best.mass / 4) : (best.mass / 10); // Amount of health in food cube

            // Start eating animation
            self.frame = 5;

            // Link gibs
            // In original:
            // for (i=0 ; i<globals.num_edicts ; i++) ... if (ent->classname == "gib") ...
            // We iterate entities again or reuse loop?
            // "link up any gibs that this monster may have spawned"
            // The monster just died (T_Damage). It likely spawned gibs in its die() or schedule.
            // But those gibs might not exist yet if they are spawned in next frame?
            // No, T_Damage calls die() immediately.
            // So we can scan for gibs near the trap.

            context.forEachEntity((ent) => {
                if (!ent.inUse) return;
                if (ent.classname !== 'gib') return; // Assuming gibs identify as 'gib'

                // Distance check (128 units)
                const dist = distance(ent.origin, self.origin);
                if (dist > 128) return;

                ent.movetype = MoveType.None; // Or custom
                ent.nextthink = time + 0.1;
                ent.think = trapGibThink; // Use exported function
                ent.owner = self;
                // trapGibThink(ent, context); // Run once immediately?
            });
        }
    }
}

export function createTrap(context: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, speed: number) {
    const trap = context.spawn();
    trap.classname = 'food_cube_trap';
    trap.origin = { ...start };
    trap.velocity = {
        x: dir.x * speed,
        y: dir.y * speed,
        z: dir.z * speed
    };

    // Add random throw variance if needed

    trap.movetype = MoveType.Bounce;
    trap.solid = Solid.BoundingBox;
    trap.takedamage = true;
    trap.health = 20;
    trap.mins = { x: -4, y: -4, z: 0 };
    trap.maxs = { x: 4, y: 4, z: 8 };
    trap.model = 'models/weapons/z_trap/tris.md2';
    trap.owner = owner;
    trap.nextthink = context.timeSeconds + 1.0;
    trap.think = trapThink;
    trap.die = trapDie;

    // Sound loop? 'weapons/traploop.wav'

    trap.timestamp = context.timeSeconds + 30.0;
    trap.clipmask = MASK_PROJECTILE & ~CONTENTS_DEADMONSTER;

    if (owner.client) {
         // Ignore player?
         trap.clipmask &= ~CONTENTS_PLAYER;
    }

    context.linkentity(trap);
    return trap;
}
