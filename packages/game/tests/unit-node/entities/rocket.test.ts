import { describe, it, expect, vi } from 'vitest';
import { createRocket } from '../../../src/entities/projectiles.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import * as damage from '../../../src/combat/damage.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createEntityFactory } from '@quake2ts/test-utils';

describe('Rocket Projectile', () => {
    it('should have correct initial properties and explode on touch', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { game } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 },
        }));

        createRocket(game.entities, player, player.origin, { x: 1, y: 0, z: 0 }, 100, 650);

        const rocket = game.entities.find((e) => e.classname === 'rocket');
        if (!rocket) throw new Error('Rocket entity not found');

        const target = spawnEntity(game.entities, createEntityFactory({
            health: 100,
            takedamage: 1,
        }));

        expect(rocket).toBeDefined();
        expect(rocket.movetype).toBe(MoveType.FlyMissile);
        expect(rocket.solid).toBe(Solid.BoundingBox);
        expect(rocket.touch).toBeDefined();

        if (rocket.touch) {
            rocket.touch(rocket, target, null, null);
        } else {
            throw new Error('Rocket touch method is not defined');
        }

        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(rocket.inUse).toBe(false);
    });
});
