// =================================================================
// Quake II - CTF Grapple
// =================================================================

import { Entity, Solid, MoveType, EntityFlags } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { WeaponId } from '@quake2ts/shared';
import { Weapon_Generic } from '../../combat/weapons/animation.js';
import { P_ProjectSource } from '../../combat/weapons/projectSource.js';
import { createProjectile } from '../../entities/projectiles.js';
import { Vec3, copyVec3, scaleVec3, addVec3, subtractVec3, normalizeVec3, dotVec3, lengthVec3, ZERO_VEC3 } from '@quake2ts/shared';
import { angleVectors } from '@quake2ts/shared';
import { T_Damage, T_RadiusDamage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';

// Grapple constants
const GRAPPLE_SPEED = 1200;
const GRAPPLE_PULL_SPEED = 800;
const GRAPPLE_DAMAGE = 20;

export interface GrappleEntity extends Entity {
    grappleState: 'fly' | 'attached';
}

declare module '../../entities/entity.js' {
    interface Entity {
        grapple?: Entity; // Link from player to grapple
    }
}

export function Grapple_Think(player: Entity, sys: EntitySystem) {
    // If not using grapple, reset
    if (player.client?.inventory.currentWeapon !== WeaponId.Grapple) {
        ResetGrapple(player, sys);
    }

    Weapon_Generic(player,
        0, 10, // ready
        11, 20, // fire
        [], // pause frames
        [11], // fire frames
        (ent: Entity) => fire_grapple(ent, sys),
        sys
    );

    // If firing button is released, release grapple
    if (player.client && !(player.client.buttons & 1)) {
         ResetGrapple(player, sys);
    }

    // Pull player if attached
    if (player.grapple && (player.grapple as GrappleEntity).grappleState === 'attached') {
        Grapple_Pull(player, player.grapple as GrappleEntity, sys);
    }
}

function fire_grapple(player: Entity, sys: EntitySystem) {
    if (player.grapple) return; // Already out

    // P_ProjectSource signature: (game, ent, offset, forward, right, up)
    const angles = player.client!.v_angle || player.angles;
    const vectors = angleVectors(angles);
    const forward = vectors.forward;
    const right = vectors.right;
    const up = vectors.up;

    const game = sys.game;
    const start = P_ProjectSource(game, player, { x: 8, y: 8, z: 8 }, forward, right, up);
    // Reuse 'forward' for direction
    const dir = { ...forward };

    // createProjectile(sys, start, dir, speed, mod, damage, radiusDamage)
    const grapple = createProjectile(sys, start, dir, GRAPPLE_SPEED, DamageMod.GRAPPLE, 0);
    grapple.classname = 'grapple';
    grapple.owner = player;
    grapple.movetype = MoveType.FlyMissile;
    grapple.solid = Solid.BoundingBox;
    grapple.mins = { x: -4, y: -4, z: -4 };
    grapple.maxs = { x: 4, y: 4, z: 4 };
    grapple.model = 'models/weapons/grapple/hook/tris.md2';

    (grapple as GrappleEntity).grappleState = 'fly';

    grapple.touch = (self, other, plane, surface) => {
        if (!other) return;
        Grapple_Touch(self as GrappleEntity, other, plane, surface, sys);
    };

    player.grapple = grapple;

    sys.sound(player, 0, 'weapons/grapple/throw.wav', 1, 1, 0);
}

function Grapple_Touch(self: GrappleEntity, other: Entity, plane: any, surface: any, sys: EntitySystem) {
    if (other === self.owner) return;
    if (self.grappleState === 'attached') return;

    if (other.takedamage) {
        // Hit something alive, damage it and detach
        T_Damage(other as any, self as any, self.owner as any, self.velocity, self.origin, ZERO_VEC3, GRAPPLE_DAMAGE, 0, 0, DamageMod.GRAPPLE, sys.timeSeconds, sys.multicast.bind(sys));

        sys.free(self);
        if (self.owner) self.owner.grapple = undefined;
        return;
    }

    if (other.solid === Solid.Bsp || other.solid === Solid.BoundingBox) {
        // Attach to wall/solid
        self.velocity = { x: 0, y: 0, z: 0 };
        self.movetype = MoveType.None;
        self.grappleState = 'attached';

        sys.sound(self, 0, 'weapons/grapple/hit.wav', 1, 1, 0);

        // Ensure it sticks
        if (plane) {
            // align?
        }
    }
}

function Grapple_Pull(player: Entity, grapple: GrappleEntity, sys: EntitySystem) {
    const dir = subtractVec3(grapple.origin, player.origin);
    const dist = lengthVec3(dir);

    if (dist < 32) return; // Close enough

    const normalizedDir = normalizeVec3(dir);
    const pull = scaleVec3(normalizedDir, GRAPPLE_PULL_SPEED);

    player.velocity = pull;
}

export function ResetGrapple(player: Entity, sys: EntitySystem) {
    if (player.grapple) {
        sys.free(player.grapple);
        player.grapple = undefined;
    }
}
