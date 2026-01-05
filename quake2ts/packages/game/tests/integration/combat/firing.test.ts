import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, type GameExports } from '../../../src/index.js';
import { Entity } from '../../../src/entities/entity.js';
import { fire } from '../../../src/combat/weapons/firing.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import { createPlayerInventory } from '../../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import { GameImports } from '../../../src/imports.js';
import { vi } from 'vitest';
import { CollisionEntityIndex, CollisionModel } from '@quake2ts/shared';
import { Solid } from '../../../src/entities/entity.js';
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
        const imports = createMockGameImports();

        // Simple AABB trace mock
        imports.trace = (start, mins, maxs, end, passEntity, contentMask) => {
            // If target is undefined or we are ignoring it, return empty trace
            if (!target || passEntity === target) {
                return {
                    fraction: 1.0,
                    endpos: end,
                    ent: null,
                    allsolid: false,
                    startsolid: false,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0
                };
            }

            // Check intersection with target AABB
            // Simplified ray-AABB check (assuming Ray trace if mins/maxs null)
            // For this test, we know player shoots at target at (100,0,0) from (0,0,0)
            // Railgun is a ray.

            // Just check if ray passes through target bounds.
            // Target is at 100,0,0. Bounds +/- 16.
            // Ray is (0,0,0) -> (8192, 0, 0) roughly (forward).
            // It should hit.

            // We can cheat: if start is near origin and end is far positive X, and target is at 100,0,0, it hits.
            // Let's implement a basic bounds check if possible, or just force hit if we detect we are shooting.

            // This is specific to the "fire railgun" scenario.
            // But we need to handle P_ProjectSource trace too (which shouldn't hit anything).

            // P_ProjectSource trace: start=eye, end=point (offset). Length is small.
            // It shouldn't hit target (100 units away).

            const dx = end.x - start.x;
            const dist = Math.sqrt(dx*dx);

            // If trace is long (shooting)
            if (dist > 500 && target) {
                 return {
                    fraction: 0.1, // Hit somewhere
                    endpos: { x: 100 - 16, y: 0, z: 0 }, // Hit min x
                    ent: target,
                    allsolid: false,
                    startsolid: false,
                    plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
                    surfaceFlags: 0,
                    contents: 0
                };
            }

            return {
                fraction: 1.0,
                endpos: end,
                ent: null,
                allsolid: false,
                startsolid: false,
                plane: null,
                surfaceFlags: 0,
                contents: 0
            };
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
