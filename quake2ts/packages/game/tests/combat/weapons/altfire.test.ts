import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '../../test-helpers.js';
import { Entity } from '../../../src/entities/entity.js';
import { fireSuperShotgun, fireRocket } from '../../../src/combat/weapons/firing.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { createRocket, createGuidedRocket } from '../../../src/entities/projectiles.js';
import { angleVectors, Vec3 } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

// Mock dependencies
vi.mock('../../../src/combat/damage.js', () => ({
  T_Damage: vi.fn(),
  T_RadiusDamage: vi.fn(),
}));

vi.mock('../../../src/entities/projectiles.js', () => ({
  createRocket: vi.fn(),
  createGuidedRocket: vi.fn(),
}));

vi.mock('@quake2ts/shared', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    angleVectors: vi.fn(() => ({
      forward: { x: 1, y: 0, z: 0 },
      right: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: 1 }
    })),
  };
});

describe('Weapon Alt-Fires', () => {
  let context: ReturnType<typeof createTestContext>;
  let player: Entity;
  let mockGame: any;

  beforeEach(() => {
    context = createTestContext();
    player = new Entity(1);
    player.client = {
      inventory: {
        ammo: {
          counts: {
            [AmmoType.Shells]: 100,
            [AmmoType.Rockets]: 100,
          }
        },
        items: [],
        weaponStates: {}
      },
      buttons: 0, // Reset buttons
      kick_angles: { x: 0, y: 0, z: 0 },
      kick_origin: { x: 0, y: 0, z: 0 },
      pm_flags: 0,
    } as any;

    // Construct a mock GameExports object
    mockGame = {
        ...context.game,
        trace: context.entities.trace,
        multicast: context.entities.multicast,
        sound: context.entities.sound,
        time: context.entities.timeSeconds,
        entities: context.entities,
        deathmatch: false
    };

    // Mock angleVectors to return predictable vectors
    vi.mocked(angleVectors).mockReturnValue({
        forward: { x: 1, y: 0, z: 0 },
        right: { x: 0, y: 1, z: 0 },
        up: { x: 0, y: 0, z: 1 }
    });
  });

  describe('Super Shotgun', () => {
    it('should fire standard spread when ATTACK2 is not pressed', () => {
      // Regular fire
      player.client!.buttons = 0;
      fireSuperShotgun(mockGame, player);

      // Verify ammo usage
      expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(98);

      // Verify kick
      expect(player.client!.kick_angles.x).toBe(-4);

      // Verify traces (spread check implies multiple pellets)
      expect(context.entities.trace).toHaveBeenCalled();
    });

    it('should fire precision spread when ATTACK2 is pressed', () => {
      // Alt fire (Precision)
      player.client!.buttons = 32; // BUTTON_ATTACK2

      // Reset mocks to clear previous calls
      vi.clearAllMocks();

      fireSuperShotgun(mockGame, player);

      // Verify ammo usage (same)
      expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(98);

      expect(context.entities.trace).toHaveBeenCalled();
    });
  });

  describe('Rocket Launcher', () => {
    it('should fire standard rocket when ATTACK2 is not pressed', () => {
      player.client!.buttons = 0;
      fireRocket(mockGame, player);

      expect(player.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(99);
      expect(createRocket).toHaveBeenCalled();
      expect(createGuidedRocket).not.toHaveBeenCalled();
    });

    it('should fire guided rocket when ATTACK2 is pressed', () => {
      player.client!.buttons = 32; // BUTTON_ATTACK2
      fireRocket(mockGame, player);

      expect(player.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(99);
      expect(createGuidedRocket).toHaveBeenCalled();
      expect(createRocket).not.toHaveBeenCalled();
    });
  });
});
