// =================================================================
// Quake II - Rocket Projectile Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { createRocket } from '../../src/entities/projectiles.js';
import { createGame } from '../../src/index.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import * as damage from '../../src/combat/damage.js';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Rocket Projectile', () => {
    it('should have correct initial properties and explode on touch', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        createRocket(game.entities, player, player.origin, { x: 1, y: 0, z: 0 }, 100, 650);

        const rocket = game.entities.find(e => e.classname === 'rocket')!;

        // Use factory via internal pool or just verification.
        // For 'target' we can't easily swap out with createEntityFactory because we need it to be in the system
        // and 'game.entities.spawn()' handles that registration.
        // We could use Object.assign to apply factory defaults to the spawned entity if needed,
        // but for now we just spawn it.
        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        expect(rocket).toBeDefined();
        expect(rocket.movetype).toBe(MoveType.FlyMissile);
        expect(rocket.solid).toBe(Solid.BoundingBox);
        expect(rocket.touch).toBeDefined();

        rocket.touch!(rocket, target);

        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(rocket.inUse).toBe(false);
    });
});
