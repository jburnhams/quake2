// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { GameExports } from '../index.js';
import { T_Damage } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

export function createRocket(game: GameExports, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const rocket = game.entities.spawn();
    rocket.classname = 'rocket';
    rocket.movetype = MoveType.FlyMissile;
    rocket.solid = Solid.BoundingBox;
    rocket.owner = owner;
    rocket.origin = { ...start };
    rocket.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    rocket.mins = { x: -4, y: -4, z: -4 };
    rocket.maxs = { x: 4, y: 4, z: 4 };
    rocket.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }

        if (self.owner && self.owner.client) {
            T_Damage(other, self, self.owner, dir, self.origin, ZERO_VEC3, damage, 0, DamageFlags.None, 0);
        }

        game.entities.free(self);
    };

    game.entities.finalizeSpawn(rocket);
}
