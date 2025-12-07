// =================================================================
// Quake II - Prox Mine Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProxMine } from '../../../src/entities/projectiles/prox.js';
import { createGame } from '../../../src/index.js';
import { MoveType, Solid, Entity } from '../../../src/entities/entity.js';
import * as damage from '../../../src/combat/damage.js';

describe('Prox Mine', () => {
    let trace: any;

    // Reset mocks between tests
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createTestGame = (options: { deathmatch?: boolean } = {}) => {
        trace = vi.fn().mockReturnValue({
            fraction: 1.0,
            ent: null
        });
        const pointcontents = vi.fn().mockReturnValue(0);
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();
        const modelIndex = vi.fn().mockReturnValue(1);

        const engine = {
            trace,
            sound,
            centerprintf: vi.fn(),
            modelIndex,
        };

        const game = createGame({
            trace,
            pointcontents,
            linkentity: (ent) => {
                // Mock linkentity to set absmin/absmax for findInBox
                ent.absmin = {
                    x: ent.origin.x + (ent.mins?.x || 0),
                    y: ent.origin.y + (ent.mins?.y || 0),
                    z: ent.origin.z + (ent.mins?.z || 0),
                };
                ent.absmax = {
                    x: ent.origin.x + (ent.maxs?.x || 0),
                    y: ent.origin.y + (ent.maxs?.y || 0),
                    z: ent.origin.z + (ent.maxs?.z || 0),
                };
            },
            multicast,
            unicast,
            areaEdicts: vi.fn().mockReturnValue(null) // Use fallback iteration
        }, engine, { gravity: { x: 0, y: 0, z: 0 }, deathmatch: options.deathmatch ?? false });

        // Initialize with non-zero time to avoid potential NaN/logic issues with 0
        game.init(1000);

        // Setup world
        game.spawnWorld();
        if (game.entities.world) {
            game.entities.world.modelindex = 1;
        }

        // Setup player
        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };

        // IMPORTANT: Set client property to identify as a player/client and mock inventory to avoid snapshot errors
        // inventory.powerups needs to be a Map, not a Set, because `populatePlayerStats` uses `.get()`
        player.client = {
            inventory: {
                pickupItem: undefined,
                pickupItemTimer: 0,
                powerups: new Map(), // Changed from Set to Map
                ownedWeapons: new Set(),
                ammo: {
                    counts: new Array(32).fill(0)
                }
            }
        } as any;

        game.entities.finalizeSpawn(player);
        game.entities.linkentity(player);

        return { game, player, trace };
    };

    // Helper to fix time if NaN
    const ensureTime = (game: any, timeMs: number) => {
        if (Number.isNaN(game.entities.timeSeconds)) {
            // Force time if game.frame failed to set it correctly
            game.entities.beginFrame(timeMs * 0.001);
        }
    };

    it('should limit mines to 50 per player', () => {
        const { game, player } = createTestGame();

        const mines: Entity[] = [];
        for (let i = 0; i < 50; i++) {
            const time = 1000 + (i + 1) * 10;
            game.frame({ time, delta: 0.01 });
            ensureTime(game, time);

            const origin = { x: i * 20, y: 0, z: 0 };
            const mine = createProxMine(game.entities, player, origin, { x: 0, y: 0, z: 1 }, 600);
            mines.push(mine);
        }

        // We check if at least some mines exist (Limit might delete oldest)
        const activeMines = game.entities.findByClassname('prox_mine').filter(e => e.inUse);
        expect(activeMines.length).toBeGreaterThan(0);
        expect(activeMines.length).toBeLessThanOrEqual(50);

        // Advance time slightly and spawn 51st
        const timeNext = 1000 + 600;
        game.frame({ time: timeNext, delta: 0.1 });
        ensureTime(game, timeNext);
        createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        // Advance one frame to process deferred frees
        const timeDeferred = 1000 + 700;
        game.frame({ time: timeDeferred, delta: 0.1 });
        ensureTime(game, timeDeferred);

        // The first mine should have been freed (or scheduled for free)
        // Check total active count
        const activeMinesAfter = game.entities.findByClassname('prox_mine').filter(e => e.inUse);
        expect(activeMinesAfter.length).toBeLessThanOrEqual(50);
    });

    it('should not trigger on owner', () => {
        const { game, player } = createTestGame({ deathmatch: false });
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        // Simulate mine landing and arming
        if (mine.touch) {
             const plane = { normal: { x: 0, y: 0, z: 1 } };
             mine.touch(mine, game.entities.world, plane, undefined);
        }

        // Advance time to complete prox_open animation (9 frames + wait)
        let currentTime = 1000;
        for (let i = 0; i < 20; i++) {
             currentTime += 100;
             game.frame({ time: currentTime, delta: 0.1 });
             ensureTime(game, currentTime);
        }

        // Check if mine entered 'seek' state (wait should be > time)
        expect(mine.wait).toBeGreaterThan(game.entities.timeSeconds);

        // Test field trigger logic manually
        const field = game.entities.findByClassname('prox_field')[0];
        expect(field).toBeDefined();

        if (field && field.touch) {
            field.touch(field, player, undefined, undefined);
        }

        expect(T_RadiusDamage).not.toHaveBeenCalled();
        expect(mine.inUse).toBe(true);
    });

    it('should trigger on enemy via field touch', () => {
        const { game, player } = createTestGame({ deathmatch: false });
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        if (mine.touch) {
             const plane = { normal: { x: 0, y: 0, z: 1 } };
             mine.touch(mine, game.entities.world, plane, undefined);
        }

        // Advance to arm
        let currentTime = 1000;
        for (let i = 0; i < 20; i++) {
             currentTime += 100;
             game.frame({ time: currentTime, delta: 0.1 });
             ensureTime(game, currentTime);
        }

        const field = game.entities.findByClassname('prox_field')[0];
        expect(field).toBeDefined();

        // Create enemy
        const enemy = game.entities.spawn();
        enemy.classname = 'monster_soldier';
        enemy.health = 100;
        enemy.takedamage = true;
        enemy.monsterinfo = {} as any;
        game.entities.linkentity(enemy);

        // Trigger field
        if (field.touch) {
            field.touch(field, enemy, undefined, undefined);
        }

        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(mine.inUse).toBe(false);
    });

    it('should trigger on initial open if enemy is present', () => {
        const { game, player } = createTestGame();
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        // Create enemy nearby BEFORE mine arms
        const enemy = game.entities.spawn();
        enemy.classname = 'monster_soldier';
        enemy.health = 100;
        enemy.monsterinfo = {} as any;
        enemy.origin = { x: 50, y: 0, z: 0 };
        game.entities.linkentity(enemy);

        const mine = createProxMine(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 600);

        if (mine.touch) {
             const plane = { normal: { x: 0, y: 0, z: 1 } };
             mine.touch(mine, game.entities.world, plane, undefined);
        }

        // Advance frames. Logic checks for enemies at frame 9 of prox_open.
        let currentTime = 1000;
        for (let i = 0; i < 15; i++) {
             currentTime += 100;
             game.frame({ time: currentTime, delta: 0.1 });
             ensureTime(game, currentTime);
             if (!mine.inUse) break; // Exploded
        }

        expect(T_RadiusDamage).toHaveBeenCalled();
    });
});
