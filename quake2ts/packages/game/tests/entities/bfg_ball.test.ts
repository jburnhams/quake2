// =================================================================
// Quake II - BFG Ball Projectile Tests
// Based on rerelease/g_weapon.cpp BFG implementation
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { createBfgBall } from '../../src/entities/projectiles.js';
import { createGame } from '../../src/index.js';
import { MoveType, Solid, ServerFlags } from '../../src/entities/entity.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('BFG Ball Projectile', () => {
    it('should have correct initial properties', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        createBfgBall(game.entities, player, player.origin, { x: 1, y: 0, z: 0 }, 200, 400, 100);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast')!;

        expect(bfgBall).toBeDefined();
        expect(bfgBall.classname).toBe('bfg blast');
        expect(bfgBall.movetype).toBe(MoveType.FlyMissile);
        expect(bfgBall.solid).toBe(Solid.BoundingBox);
        expect(bfgBall.touch).toBeDefined();
        expect(bfgBall.think).toBeDefined();
        expect(bfgBall.radius_dmg).toBe(200);
        expect(bfgBall.dmg_radius).toBe(100);
        expect(bfgBall.svflags & ServerFlags.Projectile).toBeTruthy();
    });

    it('should fire lasers at nearby targets during flight', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        // NOTE: areaEdicts default is null, meaning fallback to full scan, which is what we want here
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        // Create target monster within 256 units
        const target = game.entities.spawn();
        target.classname = 'monster_soldier';
        target.origin = { x: 200, y: 0, z: 0 };
        target.absmin = { x: 195, y: -16, z: -24 };
        target.absmax = { x: 205, y: 16, z: 32 };
        target.takedamage = true;
        target.health = 100;
        target.svflags = ServerFlags.Monster;
        target.solid = Solid.Bsp; // Must be solid for findByRadius/findInBox fallback
        game.entities.finalizeSpawn(target);

        // Mock trace for both line-of-sight check and piercing laser
        let traceCallCount = 0;
        trace.mockImplementation((start, mins, maxs, end, ignore, mask) => {
            traceCallCount++;

            // First call: line-of-sight check (should return clear)
            if (traceCallCount === 1) {
                return {
                    ent: null,
                    fraction: 1.0,
                    endpos: { x: 200, y: 0, z: 0 },
                    allsolid: false,
                    startsolid: false,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0,
                };
            }

            // Second call: piercing laser trace (should hit target)
            if (traceCallCount === 2) {
                return {
                    ent: target,
                    fraction: 0.5,
                    endpos: target.origin,
                    allsolid: false,
                    startsolid: false,
                    plane: { normal: { x: -1, y: 0, z: 0 } },
                    surfaceFlags: 0,
                    contents: 0x02000000, // CONTENTS_MONSTER
                };
            }

            // Third call: after making target non-solid, continue trace (no more hits)
            // Also used for final visual laser trace
            return {
                ent: null,
                fraction: 1.0,
                endpos: end,
                allsolid: false,
                startsolid: false,
                plane: null,
                surfaceFlags: 0,
                contents: 0,
            };
        });

        createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 100);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast')!;
        expect(bfgBall).toBeDefined();

        T_Damage.mockClear();

        // Manually trigger think to fire lasers
        bfgBall.think!(bfgBall, game.entities);

        // Should have fired laser at target
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            bfgBall,
            player,
            expect.anything(), // dir
            expect.anything(), // endpos
            expect.anything(), // plane normal
            10, // damage (single player default)
            1, // kick
            expect.anything(), // flags
            DamageMod.BFG_LASER,
            game.time,
            expect.any(Function)
        );
    });

    it('should not fire lasers at targets without line of sight', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        // Create target monster within 256 units
        const target = game.entities.spawn();
        target.classname = 'monster_soldier';
        target.origin = { x: 200, y: 0, z: 0 };
        target.absmin = { x: 195, y: -16, z: -24 };
        target.absmax = { x: 205, y: 16, z: 32 };
        target.takedamage = true;
        target.health = 100;
        target.svflags = ServerFlags.Monster;
        target.solid = Solid.Bsp;
        game.entities.finalizeSpawn(target);

        // Mock trace to return obstruction (blocked by wall)
        trace.mockReturnValue({
            ent: game.entities.world,
            fraction: 0.5,
            endpos: { x: 100, y: 0, z: 0 },
            allsolid: false,
            startsolid: false,
            plane: { normal: { x: -1, y: 0, z: 0 } },
            surfaceFlags: 0,
            contents: 0x00000001,
        });

        createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 100);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast')!;

        T_Damage.mockClear();

        // Trigger think
        bfgBall.think!(bfgBall, game.entities);

        // Should NOT have fired laser at target (blocked by wall)
        expect(T_Damage).not.toHaveBeenCalledWith(
            target,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            DamageMod.BFG_LASER,
            game.time,
            expect.anything()
        );
    });

    it('should use correct damage in deathmatch mode', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        // Create game in deathmatch mode
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        // Create target monster within 256 units
        const target = game.entities.spawn();
        target.classname = 'monster_soldier';
        target.origin = { x: 200, y: 0, z: 0 };
        target.absmin = { x: 195, y: -16, z: -24 };
        target.absmax = { x: 205, y: 16, z: 32 };
        target.takedamage = true;
        target.health = 100;
        target.svflags = ServerFlags.Monster;
        target.solid = Solid.Bsp;
        game.entities.finalizeSpawn(target);

        // Mock trace for line-of-sight and laser
        let traceCallCount = 0;
        trace.mockImplementation((start, mins, maxs, end, ignore, mask) => {
            traceCallCount++;
            if (traceCallCount === 1) {
                return {
                    ent: null,
                    fraction: 1.0,
                    endpos: { x: 200, y: 0, z: 0 },
                    allsolid: false,
                    startsolid: false,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0,
                };
            }
            if (traceCallCount === 2) {
                return {
                    ent: target,
                    fraction: 0.5,
                    endpos: target.origin,
                    allsolid: false,
                    startsolid: false,
                    plane: { normal: { x: -1, y: 0, z: 0 } },
                    surfaceFlags: 0,
                    contents: 0x02000000,
                };
            }
            return {
                ent: null,
                fraction: 1.0,
                endpos: end,
                allsolid: false,
                startsolid: false,
                plane: null,
                surfaceFlags: 0,
                contents: 0,
            };
        });

        createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 100);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast')!;

        T_Damage.mockClear();

        // Trigger think
        bfgBall.think!(bfgBall, game.entities);

        // Should have fired laser with 5 damage (deathmatch mode)
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            bfgBall,
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            5, // damage in deathmatch
            1,
            expect.anything(),
            DamageMod.BFG_LASER,
            game.time,
            expect.any(Function)
        );
    });

    it('should restore entity solidity after piercing', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        // Create target monster
        const target = game.entities.spawn();
        target.classname = 'monster_soldier';
        target.origin = { x: 100, y: 0, z: 0 };
        target.absmin = { x: 95, y: -16, z: -24 };
        target.absmax = { x: 105, y: 16, z: 32 };
        target.takedamage = true;
        target.health = 100;
        target.svflags = ServerFlags.Monster;
        target.solid = Solid.BoundingBox;
        game.entities.finalizeSpawn(target);

        const originalSolid = target.solid;

        // Mock trace to hit target
        let traceCallCount = 0;
        trace.mockImplementation((start, mins, maxs, end, ignore, mask) => {
            traceCallCount++;

            // Line of sight check
            if (traceCallCount === 1) {
                return {
                    ent: null,
                    fraction: 1.0,
                    endpos: end,
                    allsolid: false,
                    startsolid: false,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0,
                };
            }

            // Piercing laser hits target
            if (traceCallCount === 2) {
                return {
                    ent: target,
                    fraction: 0.5,
                    endpos: target.origin,
                    allsolid: false,
                    startsolid: false,
                    plane: { normal: { x: -1, y: 0, z: 0 } },
                    surfaceFlags: 0,
                    contents: 0x02000000, // CONTENTS_MONSTER
                };
            }

            // After piercing, no more hits
            return {
                ent: null,
                fraction: 1.0,
                endpos: end,
                allsolid: false,
                startsolid: false,
                plane: null,
                surfaceFlags: 0,
                contents: 0,
            };
        });

        createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 100);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast')!;

        // Trigger think
        bfgBall.think!(bfgBall, game.entities);

        // Entity solidity should be restored after piercing
        expect(target.solid).toBe(originalSolid);
    });
});
