import { describe, it, expect, vi } from 'vitest';
import { player_die } from '../../src/entities/player.js';
import { DeadFlag, Solid, MoveType } from '../../src/entities/entity.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { EntitySystem } from '../../src/entities/system.js';
import type { GameEngine } from '../../src/index.js';
import { createPlayerEntityFactory, createEntityFactory } from '@quake2ts/test-utils';

describe('Player Death', () => {
    it('should set dead flags and properties', () => {
        const player = createPlayerEntityFactory({
            number: 1,
            health: 0,
            origin: { x: 0, y: 0, z: 0 }
        });

        player_die(player, null, null, 10, { x: 0, y: 0, z: 0 }, DamageMod.UNKNOWN);

        expect(player.deadflag).toBe(DeadFlag.Dead);
        expect(player.solid).toBe(Solid.Not);
        expect(player.movetype).toBe(MoveType.Toss);
        expect(player.takedamage).toBe(false);
    });

    it('should throw gibs if health is low enough', () => {
        const mockEngine: GameEngine = {
            modelIndex: vi.fn().mockReturnValue(1),
            centerprintf: vi.fn(),
        } as any;

        const mockImports = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
            linkentity: vi.fn(),
            multicast: vi.fn(),
            unicast: vi.fn(),
        };

        const system = new EntitySystem(mockEngine, mockImports as any);
        const spawnSpy = vi.spyOn(system, 'spawn').mockReturnValue({} as any);

        const player = createPlayerEntityFactory({
            number: 1,
            health: -50,
            origin: { x: 0, y: 0, z: 0 }
        });

        player_die(player, null, null, 100, { x: 0, y: 0, z: 0 }, DamageMod.ROCKET, system);

        expect(spawnSpy).toHaveBeenCalled(); // Gibs spawned
    });

    it('should display obituary', () => {
        const mockEngine: GameEngine = {
            centerprintf: vi.fn(),
        } as any;

        const mockImports = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
            linkentity: vi.fn(),
            multicast: vi.fn(),
            unicast: vi.fn(),
        };

        const system = new EntitySystem(mockEngine, mockImports as any);

        const player = createPlayerEntityFactory({
            number: 1,
            health: 0
        });

        const attacker = createEntityFactory({
            number: 2,
            classname: 'monster_soldier'
        });

        player_die(player, null, attacker, 10, { x: 0, y: 0, z: 0 }, DamageMod.MACHINEGUN, system);
        // player_die now uses ClientObituary which uses sys.multicast with ServerCommand.print, not centerprintf
        expect(mockImports.multicast).toHaveBeenCalled();
    });
});
