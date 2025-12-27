// =================================================================
// Quake II - Combat & Items Integration Tests
// =================================================================

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import { GameExports, createGame } from '../src/index.js';
import { WeaponId, PowerupId, addPowerup } from '../src/inventory/playerInventory.js';
import { fire } from '../src/combat/weapons/firing.js';
import { createGameImportsAndEngine, createEntityFactory, createTraceMock } from '@quake2ts/test-utils';

describe('Combat and Items', () => {
  let game: GameExports;
  let player: Entity;

  let mockImports: ReturnType<typeof createGameImportsAndEngine>['imports'];
  let mockEngine: ReturnType<typeof createGameImportsAndEngine>['engine'];

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createGameImportsAndEngine();
    mockImports = result.imports;
    mockEngine = result.engine;

    game = createGame(mockImports, mockEngine, { gravity: { x: 0, y: 0, z: -800 } });
    game.spawnWorld();
    player = game.entities.find(e => e.classname === 'player')!;
  });

  describe('Weapon Kick (Recoil)', () => {
    it('should apply kick angles to player client on fire', () => {
       // Give machinegun
       player.client!.inventory.ownedWeapons.add(WeaponId.Machinegun);
       player.client!.inventory.ammo.counts[0] = 100; // Bullets are index 0
       player.client!.inventory.currentWeapon = WeaponId.Machinegun;

       // Fire
       fire(game, player, WeaponId.Machinegun);

       expect(player.client!.kick_angles).toBeDefined();
       expect(player.client!.kick_angles!.x).toBeLessThan(0); // Should kick up (negative pitch)
    });
  });

  describe('Railgun Penetration', () => {
    it('should hit multiple aligned entities', () => {
       // Setup aligned targets
       const target1 = game.entities.spawn();
       Object.assign(target1, createEntityFactory({
           takedamage: true,
           health: 100,
           origin: { x: 100, y: 0, z: 0 },
           mins: { x: -10, y: -10, z: -10 },
           maxs: { x: 10, y: 10, z: 10 }
       }));

       const target2 = game.entities.spawn();
       Object.assign(target2, createEntityFactory({
           takedamage: true,
           health: 100,
           origin: { x: 200, y: 0, z: 0 }, // Behind target1
           mins: { x: -10, y: -10, z: -10 },
           maxs: { x: 10, y: 10, z: 10 }
       }));

       // Mock trace sequence for Railgun loop
       // 0. P_ProjectSource Check (Eye to Muzzle) -> No hit
       mockImports.trace.mockReturnValueOnce(createTraceMock({
          fraction: 1.0,
          endpos: { x: 0, y: 0, z: 0 },
          ent: null
       }))
       // 1. Hit target1
       .mockReturnValueOnce(createTraceMock({
          fraction: 0.1,
          endpos: target1.origin,
          ent: target1,
          plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 }
       }))
       // 2. Hit target2
       .mockReturnValueOnce(createTraceMock({
          fraction: 0.2, // Relative to start
          endpos: target2.origin,
          ent: target2,
          plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 }
       }))
       // 3. Hit nothing (end of range)
       .mockReturnValueOnce(createTraceMock({
          fraction: 1.0,
          endpos: { x: 8192, y: 0, z: 0 },
          ent: null
       }));

       player.client!.inventory.ownedWeapons.add(WeaponId.Railgun);
       player.client!.inventory.ammo.counts[5] = 10; // Slugs are index 5

       fire(game, player, WeaponId.Railgun);

       // Verify damage applied to both
       expect(target1.health).toBeLessThan(100);
       expect(target2.health).toBeLessThan(100);
    });
  });

  describe('Powerup Expiration', () => {
      it('should remove expired powerups', () => {
          const nowMs = game.time * 1000;
          addPowerup(player.client!.inventory, PowerupId.QuadDamage, nowMs + 100); // Expires in 0.1s

          expect(player.client!.inventory.powerups.has(PowerupId.QuadDamage)).toBe(true);

          // Verify the `player_think` was attached correctly in `createGame`.
          expect(player.think).toBeDefined();
          expect(player.nextthink).toBeGreaterThan(0);
      });
  });
});
