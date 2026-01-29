import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { WeaponId } from '../../src/inventory/index.js';
import { AmmoItemId, pickupAmmo } from '../../src/inventory/ammo.js';
import { createPlayerClientFactory, createTestGame } from '@quake2ts/test-utils';

describe('Player State Snapshot', () => {
    let game: GameExports;
    let player: Entity;

    beforeEach(() => {
        vi.clearAllMocks();

        // Use createTestGame for cleaner setup
        const result = createTestGame({
            config: {
                deathmatch: false
            }
        });
        game = result.game;

        const mockClient = createPlayerClientFactory();

        // Capture the returned player entity directly
        player = game.clientBegin(mockClient);
    });

    it('should correctly report ammo for current weapon', () => {
        // Give shotgun and shells
        const inv = player.client!.inventory;
        inv.ownedWeapons.add(WeaponId.Shotgun);
        inv.currentWeapon = WeaponId.Shotgun;

        pickupAmmo(inv.ammo, AmmoItemId.Shells, { countOverride: 25 });

        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1, nowMs: 100 });

        // Assert
        expect(snapshot.state.ammo).toBe(25);
    });

    it('should report correct viewangles', () => {
        player.angles = { x: 10, y: 20, z: 5 };
        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1, nowMs: 100 });

        expect(snapshot.state.viewangles.x).toBe(10);
        expect(snapshot.state.viewangles.y).toBe(20);
        expect(snapshot.state.viewangles.z).toBe(5);
    });

    it('should report correct fov', () => {
        player.client!.fov = 110;
        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1, nowMs: 100 });

        expect(snapshot.state.fov).toBe(110);
    });
});
