import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPlayerEntityFactory, createMonsterEntityFactory, createTestGame, spawnEntity } from '@quake2ts/test-utils';
import { player_die } from '../../../src/entities/player.js';
import { DeadFlag, Solid, MoveType, Entity } from '../../../src/entities/entity.js';
import { DamageMod } from '../../../src/combat/damageMods.js';

describe('Player Death', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should set dead flags and properties', () => {
        const { game } = createTestGame();

        // Spawn the player using the system
        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            health: 0,
            origin: { x: 0, y: 0, z: 0 }
        }));

        // Pass game.entities as system
        player_die(player, null, null, 10, { x: 0, y: 0, z: 0 }, DamageMod.UNKNOWN, game.entities);

        expect(player.deadflag).toBe(DeadFlag.Dead);
        expect(player.solid).toBe(Solid.Not);
        expect(player.movetype).toBe(MoveType.Toss);
        expect(player.takedamage).toBe(false);
    });

    it('should throw gibs if health is low enough', () => {
        const { game } = createTestGame({
            imports: {
                linkentity: vi.fn(),
            }
        });
        const system = game.entities;

        // Spy on spawn to check for gibs
        const spawnSpy = vi.spyOn(system, 'spawn');

        const player = spawnEntity(system, createPlayerEntityFactory({
            health: -50,
            origin: { x: 0, y: 0, z: 0 }
        }));

        player_die(player, null, null, 100, { x: 0, y: 0, z: 0 }, DamageMod.ROCKET, system);

        expect(spawnSpy).toHaveBeenCalled(); // Gibs spawned
    });

    it('should display obituary', () => {
        const { game, imports } = createTestGame();
        const system = game.entities;

        const player = spawnEntity(system, createPlayerEntityFactory({
            health: 0
        }));

        const attacker = spawnEntity(system, createMonsterEntityFactory('monster_soldier', {
            number: 2
        }));

        player_die(player, null, attacker, 10, { x: 0, y: 0, z: 0 }, DamageMod.MACHINEGUN, system);

        expect(imports.multicast).toHaveBeenCalled();
    });
});
