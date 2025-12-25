import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameExports } from '../src/index.js';
import { Entity, EntityFlags, MoveType } from '../src/entities/entity.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';
import { T_Damage, DamageFlags, DamageMod } from '../src/combat/index.js';
import { giveItem } from '../src/inventory/index.js';

// Mock T_Damage
vi.mock('../src/combat/index.js', async () => {
    const actual = await vi.importActual('../src/combat/index.js');
    return {
        ...actual,
        T_Damage: vi.fn(),
    };
});

// Mock giveItem
vi.mock('../src/inventory/index.js', async () => {
    const actual = await vi.importActual('../src/inventory/index.js');
    return {
        ...actual,
        giveItem: vi.fn(),
    };
});

describe('Admin/Cheat APIs', () => {
    let game: GameExports;
    let player: Entity;
    let entities: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();

        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        // Mock the entity system find method to return a player
        player = new Entity(1);
        player.classname = 'player';
        player.flags = 0;
        player.movetype = MoveType.Walk;
        player.origin = { x: 10, y: 20, z: 30 };
        player.velocity = { x: 0, y: 0, z: 0 };

        // Inject player into the internal entity system
        // Since createGame creates its own internal EntitySystem, we need to inspect how 'find' is implemented there.
        // It iterates over `game.entities`.

        // We can't easily inject into the private EntitySystem of game.
        // But game.entities is exposed!
        entities = game.entities;

        // We need to mock 'find' on game.entities or add the player to it.
        // 'find' iterates using forEachEntity.
        // Let's spy on find directly since it is exposed.
        vi.spyOn(entities, 'find').mockReturnValue(player);

        // Also mock unlink/link for teleport
        vi.spyOn(entities, 'unlink');
        vi.spyOn(entities, 'link');
    });

    it('setGodMode should toggle GodMode flag on player', () => {
        game.setGodMode(true);
        expect((player.flags & EntityFlags.GodMode)).toBe(EntityFlags.GodMode);

        game.setGodMode(false);
        expect((player.flags & EntityFlags.GodMode)).toBe(0);
    });

    it('setNoclip should toggle MoveType.Noclip on player', () => {
        game.setNoclip(true);
        expect(player.movetype).toBe(MoveType.Noclip);

        game.setNoclip(false);
        expect(player.movetype).toBe(MoveType.Walk);
    });

    it('setNotarget should toggle NoTarget flag on player', () => {
        game.setNotarget(true);
        expect((player.flags & EntityFlags.NoTarget)).toBe(EntityFlags.NoTarget);

        game.setNotarget(false);
        expect((player.flags & EntityFlags.NoTarget)).toBe(0);
    });

    it('giveItem should call inventory giveItem', () => {
        game.giveItem('weapon_shotgun');
        expect(giveItem).toHaveBeenCalledWith(player, 'weapon_shotgun');
    });

    it('damage should call T_Damage on player', () => {
        game.damage(50);
        // Correct expectation for arguments.
        // The call in index.ts:
        // T_Damage(
        //   player, null, null, ZERO_VEC3, player.origin, ZERO_VEC3, amount, 0, DamageFlags.NONE, DamageMod.UNKNOWN,
        //   levelClock.current.timeSeconds, undefined, { hooks: hookRegistry }
        // );
        // Arg 10: levelClock.current.timeSeconds (matches expectation '0' from test helper context)
        // Arg 11: undefined
        // Arg 12: options object containing hooks
        expect(T_Damage).toHaveBeenCalledWith(
            player,
            null,
            null,
            { x: 0, y: 0, z: 0 },
            player.origin,
            { x: 0, y: 0, z: 0 },
            50,
            0,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            expect.any(Number), // dflags (passed levelClock.timeSeconds)
            undefined,          // multicast (passed undefined explicitly)
            expect.objectContaining({ hooks: expect.any(Object) }) // options (received hooks)
        );
    });

    it('teleport should update player origin and reset velocity', () => {
        const newOrigin = { x: 100, y: 200, z: 300 };
        player.velocity = { x: 10, y: 10, z: 10 };

        game.teleport(newOrigin);

        expect(entities.unlink).toHaveBeenCalledWith(player);
        expect(player.origin).toEqual(newOrigin);
        expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });
        expect(entities.link).toHaveBeenCalledWith(player);
    });

    it('API methods should gracefully handle missing player', () => {
         vi.spyOn(entities, 'find').mockReturnValue(undefined);

         expect(() => game.setGodMode(true)).not.toThrow();
         expect(() => game.setNoclip(true)).not.toThrow();
         expect(() => game.setNotarget(true)).not.toThrow();
         expect(() => game.giveItem('foo')).not.toThrow();
         expect(() => game.damage(10)).not.toThrow();
         expect(() => game.teleport({x:0,y:0,z:0})).not.toThrow();
    });
});
