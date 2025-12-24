
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireHandGrenade } from '../../../src/combat/weapons/firing.js';
import { NoAmmoWeaponChange } from '../../../src/combat/weapons/switching.js';
import { Throw_Generic } from '../../../src/combat/weapons/animation.js';
import { Entity } from '../../../src/entities/entity.js';
import { PlayerInventory, WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import { GameExports } from '../../../src/index.js';
import { WeaponState } from '../../../src/combat/weapons/state.js';

// Mock dependencies
vi.mock('../../../src/combat/weapons/switching.js', () => ({
    NoAmmoWeaponChange: vi.fn(),
    getBestWeapon: vi.fn(),
    ChangeWeapon: vi.fn(),
}));

vi.mock('../../../src/combat/weapons/animation.js', () => ({
    Throw_Generic: vi.fn(),
}));

describe('fireHandGrenade', () => {
    let mockGame: GameExports;
    let mockPlayer: Entity;
    let mockInventory: PlayerInventory;
    let mockWeaponState: WeaponState;

    beforeEach(() => {
        mockGame = {
            time: 1000,
            entities: {},
            hooks: {},
            multicast: vi.fn(),
            setLagCompensation: vi.fn(),
            trace: vi.fn(),
            sound: vi.fn(),
        } as unknown as GameExports;

        mockInventory = {
            ammo: {
                counts: {
                    [AmmoType.Grenades]: 0
                }
            },
            currentWeapon: WeaponId.HandGrenade
        } as unknown as PlayerInventory;

        mockPlayer = {
            client: {
                inventory: mockInventory,
            }
        } as unknown as Entity;

        mockWeaponState = {} as WeaponState;

        vi.clearAllMocks();
    });

    it('should call NoAmmoWeaponChange and return when grenade ammo is < 1', () => {
        mockInventory.ammo.counts[AmmoType.Grenades] = 0;

        fireHandGrenade(mockGame, mockPlayer, mockInventory, mockWeaponState);

        expect(NoAmmoWeaponChange).toHaveBeenCalledWith(mockPlayer);
        expect(Throw_Generic).not.toHaveBeenCalled();
    });

    it('should not call NoAmmoWeaponChange and proceed to throw when grenade ammo is >= 1', () => {
        mockInventory.ammo.counts[AmmoType.Grenades] = 1;

        fireHandGrenade(mockGame, mockPlayer, mockInventory, mockWeaponState);

        expect(NoAmmoWeaponChange).not.toHaveBeenCalled();
        expect(Throw_Generic).toHaveBeenCalled();
    });
});
