import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameExports } from '../src/index.js';
import { Entity, EntityFlags, MoveType } from '../src/entities/entity.js';
import { createGameImportsAndEngine, createPlayerEntityFactory } from '@quake2ts/test-utils';
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
        // Use createPlayerEntityFactory to ensure a consistent player mock
        player = new Entity(1);
        Object.assign(player, createPlayerEntityFactory({
             flags: 0,
             movetype: MoveType.Walk,
             origin: { x: 10, y: 20, z: 30 },
             velocity: { x: 0, y: 0, z: 0 }
        }));

        // Inject player into the internal entity system
        entities = game.entities;

        // Spy on find directly since it is exposed.
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
            expect.any(Number),
            undefined,
            expect.objectContaining({ hooks: expect.any(Object) })
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
