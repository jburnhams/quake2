import { describe, it, expect } from 'vitest';
import {
  createMockInventory,
  createMockItem,
  createMockWeaponItem,
  createMockHealthItem,
  createMockArmorItem,
  createMockPowerupItem,
  createMockAmmoItem
} from '../../../src/game/mocks/items.js';
import { WeaponId, AmmoItemId } from '@quake2ts/game';

describe('Game Item Mocks', () => {
  describe('createMockInventory', () => {
    it('should create a default inventory', () => {
      const inventory = createMockInventory();
      expect(inventory.ammo.counts.length).toBeGreaterThan(0);
      expect(inventory.ownedWeapons).toBeDefined();
      expect(inventory.keys.size).toBe(0);
    });

    it('should accept overrides', () => {
      const inventory = createMockInventory({
        currentWeapon: WeaponId.Railgun
      });
      expect(inventory.currentWeapon).toBe(WeaponId.Railgun);
    });
  });

  describe('createMockItem', () => {
    it('should find existing item definition', () => {
      const item = createMockItem('weapon_railgun');
      expect(item.name).toBe('Railgun');
    });

    it('should create generic item if not found', () => {
      const item = createMockItem('unknown_item');
      expect(item.id).toBe('unknown_item');
      expect(item.name).toBe('Mock Item unknown_item');
    });

    it('should apply overrides', () => {
      const item = createMockItem('weapon_railgun', { name: 'Custom Railgun' });
      expect(item.name).toBe('Custom Railgun');
    });
  });

  describe('createMockWeaponItem', () => {
    it('should create weapon item from ID', () => {
      const item = createMockWeaponItem(WeaponId.Railgun);
      expect(item.id).toBe('weapon_railgun');
      expect(item.type).toBe('weapon');
    });

    it('should apply overrides', () => {
      const item = createMockWeaponItem(WeaponId.Railgun, { initialAmmo: 100 });
      expect(item.initialAmmo).toBe(100);
    });
  });

  describe('createMockHealthItem', () => {
    it('should create health item', () => {
      const item = createMockHealthItem(50);
      expect(item.type).toBe('health');
      expect(item.amount).toBe(50);
    });
  });

  describe('createMockArmorItem', () => {
    it('should create armor item', () => {
      const item = createMockArmorItem(25);
      expect(item.type).toBe('armor');
      expect(item.amount).toBe(25);
    });
  });

  describe('createMockAmmoItem', () => {
    it('should create ammo item', () => {
      const item = createMockAmmoItem(AmmoItemId.Shells);
      expect(item.id).toBe(AmmoItemId.Shells);
    });

    it('should throw on unknown ammo', () => {
        expect(() => createMockAmmoItem('invalid' as AmmoItemId)).toThrow();
    });
  });

  describe('createMockPowerupItem', () => {
    it('should create powerup item', () => {
      const item = createMockPowerupItem('item_quad', 30);
      expect(item.type).toBe('powerup');
      expect(item.timer).toBe(30);
    });
  });
});
