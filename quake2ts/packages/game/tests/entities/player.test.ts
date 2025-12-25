import { describe, it, expect, vi } from 'vitest';
import { createPlayerEntityFactory, createMonsterEntityFactory, createGameImportsAndEngine } from '@quake2ts/test-utils';
import { player_die } from '../../src/entities/player.js';
import { DeadFlag, Solid, MoveType, Entity } from '../../src/entities/entity.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('Player Death', () => {
    it('should set dead flags and properties', () => {
        // We need a real entity for methods, factory returns partial
        // Using Object.assign on new Entity(1) is the safe way to ensure we have a full Entity instance
        // but populating it with factory data.
        const player = new Entity(1);
        Object.assign(player, createPlayerEntityFactory({
            number: 1,
            health: 0,
            origin: { x: 0, y: 0, z: 0 }
        }));

        player_die(player, null, null, 10, { x: 0, y: 0, z: 0 }, DamageMod.UNKNOWN);

        expect(player.deadflag).toBe(DeadFlag.Dead);
        expect(player.solid).toBe(Solid.Not);
        expect(player.movetype).toBe(MoveType.Toss);
        expect(player.takedamage).toBe(false);
    });

    it('should throw gibs if health is low enough', () => {
        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                linkentity: vi.fn(),
            }
        });
        const system = new EntitySystem(engine, imports as any);
        const spawnSpy = vi.spyOn(system, 'spawn').mockImplementation(() => new Entity(100));

        const player = new Entity(1);
        Object.assign(player, createPlayerEntityFactory({
            number: 1,
            health: -50,
            origin: { x: 0, y: 0, z: 0 }
        }));

        player_die(player, null, null, 100, { x: 0, y: 0, z: 0 }, DamageMod.ROCKET, system);

        expect(spawnSpy).toHaveBeenCalled(); // Gibs spawned
    });

    it('should display obituary', () => {
        const { imports, engine } = createGameImportsAndEngine();
        const system = new EntitySystem(engine, imports as any);

        const player = new Entity(1);
        Object.assign(player, createPlayerEntityFactory({
            number: 1,
            health: 0
        }));

        const attacker = new Entity(2);
        Object.assign(attacker, createMonsterEntityFactory('monster_soldier', {
            number: 2
        }));

        player_die(player, null, attacker, 10, { x: 0, y: 0, z: 0 }, DamageMod.MACHINEGUN, system);

        expect(imports.multicast).toHaveBeenCalled();
    });
});
