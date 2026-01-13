import { describe, it, expect } from 'vitest';
import { createGame } from '../src/index.js';
import { WeaponId } from '@quake2ts/shared';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Player State Exports', () => {
  it('should expose correct player state fields in snapshot', () => {
    // Setup minimal game using createGameImportsAndEngine
    const { imports, engine } = createGameImportsAndEngine();

    const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
    game.spawnWorld(); // Should spawn player in default mode

    // Manually set some player state
    const player = game.entities.find(e => e.classname === 'player');
    expect(player).toBeDefined();
    if (!player || !player.client) throw new Error('Player not spawned');

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
    // The previous failure: "expected 0.3 to be close to 0.5".
    // So the decay is happening.

    // We expect it to be 0.3 after 0.1s frame.
    expect(state.damageAlpha).toBeCloseTo(0.3, 1);

    expect(state.viewangles).toEqual({ x: 10, y: 20, z: 30 });
    expect(state.pm_flags).toBe(123);
  });
});
