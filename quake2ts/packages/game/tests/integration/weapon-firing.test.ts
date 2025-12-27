import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, type GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { fire } from '../../src/combat/weapons/firing.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { createPlayerInventory } from '../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import { GameImports } from '../../src/imports.js';
import { vi } from 'vitest';
import { CollisionEntityIndex, CollisionModel, Solid } from '@quake2ts/shared';
import { makeBrushFromMinsMaxs } from '@quake2ts/test-utils';

const createMockGameImports = (): GameImports => ({
    trace: vi.fn(),
    pointcontents: vi.fn(() => 0),
    setmodel: vi.fn(),
    configstring: vi.fn(),
    modelindex: vi.fn(() => 1),
    soundindex: vi.fn(() => 1),
    imageindex: vi.fn(() => 1),
    linkentity: vi.fn(),
    unlinkentity: vi.fn(),
    multicast: vi.fn(),
    unicast: vi.fn(),
    sound: vi.fn(),
    centerprintf: vi.fn(),
    bprint: vi.fn(),
    dprint: vi.fn(),
    error: vi.fn(),
    cvar_get: vi.fn(),
    cvar_set: vi.fn(),
    cvar_forceset: vi.fn(),
    argc: vi.fn(() => 0),
    argv: vi.fn(() => ''),
    args: vi.fn(() => ''),
    positiondms: vi.fn()
});

describe('Weapon Firing Integration Test', () => {
    let game: GameExports;
    let player: Entity;
    let target: Entity;

    beforeEach(() => {
        const collisionIndex = new CollisionEntityIndex();
        const imports = createMockGameImports();

        // Adapt game trace signature to CollisionEntityIndex.trace signature
        imports.trace = (start, end, mins, maxs, passEntity, contentMask) => {
            return collisionIndex.trace({
                model: undefined as any, // No BSP model
                start,
                end,
                mins,
                maxs,
                contentMask,
                passId: passEntity ? passEntity.index : undefined
            });
        };

        const mockEngine = {
            trace: imports.trace,
        };

        game = createGame(imports, mockEngine as any, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);
        game.spawnWorld();

        player = game.entities.spawn();
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
        };
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.client.inventory.ammo.counts[AmmoType.Slugs] = 10;

        target = game.entities.spawn();
        target.takedamage = true;
        target.health = 100;
        target.origin = { x: 100, y: 0, z: 0 };
        target.solid = Solid.BoundingBox;
        target.mins = { x: -16, y: -16, z: -16 };
        target.maxs = { x: 16, y: 16, z: 16 };
        game.entities.link(target);
    });

    it('should damage the target with the railgun in single-player mode', () => {
        game.deathmatch = false;
        fire(game, player, WeaponId.Railgun);
        expect(target.health).toBe(100 - 125);
    });

    it('should damage the target with the railgun in deathmatch mode', () => {
        game.deathmatch = true;
        fire(game, player, WeaponId.Railgun);
        expect(target.health).toBe(100 - 100);
    });
});
