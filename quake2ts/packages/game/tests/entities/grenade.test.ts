// =================================================================
// Quake II - Grenade Projectile Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { createGrenade } from '../../src/entities/projectiles.js';
import { createGame } from '../../src/index.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import * as damage from '../../src/combat/damage.js';
import { createEntityFactory, createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Grenade Projectile', () => {
    it('should have correct initial properties and explode on think', () => {
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

        // If we were creating the player manually for testing createGrenade directly,
        // we would use createEntityFactory. But here we rely on game.spawnWorld() to behave normally.
        // However, let's verify we can find the player.

        const player = game.entities.find(e => e.classname === 'player')!;

        createGrenade(game.entities, player, player.origin, { x: 1, y: 0, z: 0 }, 120, 600);

        const grenade = game.entities.find(e => e.classname === 'grenade')!;

        expect(grenade).toBeDefined();
        expect(grenade.movetype).toBe(MoveType.Bounce);
        expect(grenade.solid).toBe(Solid.BoundingBox);
        expect(grenade.touch).toBeDefined();

        game.frame({ time: 2500, delta: 2.5 });

        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(grenade.inUse).toBe(false);
    });
});
