import { describe, it, expect } from 'vitest';
import { WeaponId } from '@quake2ts/shared';
import { createTestGame, createPlayerClientFactory } from '@quake2ts/test-utils';

describe('Player State Exports', () => {
  it('should expose correct player state fields in snapshot', () => {
    // Setup minimal game using createTestGame
    const { game } = createTestGame();

    // Use clientBegin to properly spawn and initialize the player (including think functions)
    const player = game.clientBegin(createPlayerClientFactory());

    player.client.pm_flags = 123;
    player.client.fov = 110;

    player.client.currentAmmoCount = 50;

    if (player.client.inventory) {
        player.client.inventory.ownedWeapons.add(WeaponId.Shotgun);
        player.client.inventory.currentWeapon = WeaponId.Shotgun;
        // Shells index 1
        player.client.inventory.ammo.counts[1] = 50;
    }

    player.client.damage_alpha = 0.5;
    player.angles = { x: 10, y: 20, z: 30 };

    // Get snapshot
    const frame = game.frame({ deltaSeconds: 0.1, nowMs: 100, frame: 1 });
    const state = frame.state;

    // Verify fields
    expect(state.pmFlags).toBe(123);
    expect(state.fov).toBe(110);
    expect(state.ammo).toBe(50);

    // damage_alpha decays:
    // In player.ts P_PlayerThink:
    // if (ent.client.damage_alpha) { ent.client.damage_alpha -= 0.1 * 2.0; ... }
    // 0.5 - 0.2 = 0.3.
    expect(state.damageAlpha).toBeCloseTo(0.3, 1);

    expect(state.viewangles).toEqual({ x: 10, y: 20, z: 30 });
    expect(state.pm_flags).toBe(123);
  });
});
