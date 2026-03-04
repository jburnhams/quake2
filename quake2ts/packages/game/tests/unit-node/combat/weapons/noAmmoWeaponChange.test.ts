
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireHandGrenade } from '../../../../src/combat/weapons/firing.js';
import { NoAmmoWeaponChange } from '../../../../src/combat/weapons/switching.js';
import { Throw_Generic } from '../../../../src/combat/weapons/animation.js';
import { Entity } from '../../../../src/entities/entity.js';
import { PlayerInventory, WeaponId } from '../../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../../src/inventory/ammo.js';
import { GameExports } from '../../../../src/index.js';
import { WeaponState } from '../../../../src/combat/weapons/state.js';

import * as switching from '../../../../src/combat/weapons/switching.js';
import * as animation from '../../../../src/combat/weapons/animation.js';

describe('fireHandGrenade', () => {
    let mockGame: GameExports;
    let mockPlayer: Entity;
    let mockInventory: PlayerInventory;
    let mockWeaponState: WeaponState;
    let noAmmoWeaponChangeSpy: any;
    let throwGenericSpy: any;

    beforeEach(() => {
        noAmmoWeaponChangeSpy = vi.spyOn(switching, 'NoAmmoWeaponChange').mockImplementation(() => undefined);
        throwGenericSpy = vi.spyOn(animation, 'Throw_Generic').mockImplementation(() => undefined);
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

        expect(noAmmoWeaponChangeSpy).toHaveBeenCalledWith(mockPlayer);
        expect(throwGenericSpy).not.toHaveBeenCalled();
    });

    it('should not call NoAmmoWeaponChange and proceed to throw when grenade ammo is >= 1', () => {
        mockInventory.ammo.counts[AmmoType.Grenades] = 1;

        fireHandGrenade(mockGame, mockPlayer, mockInventory, mockWeaponState);

        expect(noAmmoWeaponChangeSpy).not.toHaveBeenCalled();
        expect(throwGenericSpy).toHaveBeenCalled();
    });
});
